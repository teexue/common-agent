package httpapi

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/telemetry"
	"github.com/teexue/common-agent/tools/registry"
)

// Server exposes agent HTTP endpoints via Gin.
type Server struct {
	agentsDir   string
	skillsDir   string
	registry    *registry.Registry
	newProvider func(a *agent.Agent) (provider.Provider, error)
	staticFS    fs.FS               // optional embedded frontend; nil disables static serving
	logger      *slog.Logger
	store       session.Store       // optional session persistence; nil disables session endpoints
	svc         *service.Service    // shared business logic
	approver    *HTTPApprover       // handles tool approval flow
	eventLogger *audit.EventLogger  // optional event logging; nil disables replay
	catalog     *provider.Catalog   // optional provider catalog; nil disables provider listing
	auditStore  *audit.AuditStore   // optional audit store; nil disables audit export
	health      *telemetry.HealthServer
	watcher     *agent.Watcher    // watches agents dir for changes
	shutdownCtx context.Context   // cancelled on server shutdown; nil = no shutdown propagation
	apiKey      string            // when non-empty, all /v1/ routes require this key

	// changeCh broadcasts agent file change events to SSE subscribers.
	changeCh chan agentChange
}

// ServerConfig holds configuration for creating a new HTTP server.
type ServerConfig struct {
	AgentsDir   string
	Registry    *registry.Registry
	NewProvider func(a *agent.Agent) (provider.Provider, error)
	StaticFS    fs.FS
	Logger      *slog.Logger
	Store       session.Store
}

// NewServer creates an HTTP server wiring.
// If staticFS is non-nil, the server also serves the embedded frontend SPA.
// If store is non-nil, session endpoints are enabled.
func NewServer(cfg ServerConfig) *Server {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	svc := service.New(service.ServiceConfig{
		AgentsDir:   cfg.AgentsDir,
		Registry:    cfg.Registry,
		NewProvider: cfg.NewProvider,
		Logger:      logger,
		Store:       cfg.Store,
	})
	return &Server{
		agentsDir:   cfg.AgentsDir,
		skillsDir:   filepath.Join(filepath.Dir(cfg.AgentsDir), "skills"),
		registry:    cfg.Registry,
		newProvider: cfg.NewProvider,
		staticFS:    cfg.StaticFS,
		logger:      logger,
		store:       cfg.Store,
		svc:         svc,
		approver:    NewHTTPApprover(),
		health:      telemetry.NewHealthServer(),
		changeCh:    make(chan agentChange, 16),
	}
}

// SetStore sets the session store and updates the shared service.
func (s *Server) SetStore(store session.Store) {
	s.store = store
	s.svc.Store = store
}

// SetEventLogger sets the event logger for session replay.
func (s *Server) SetEventLogger(el *audit.EventLogger) {
	s.eventLogger = el
}

// SetShutdownCtx sets a context that is cancelled on server shutdown.
// Active agent runs will stop when this context is cancelled.
func (s *Server) SetShutdownCtx(ctx context.Context) {
	s.shutdownCtx = ctx
}

// SetAPIKey enables API key authentication for all /v1/ routes.
// When set to a non-empty value, clients must send the key via
// the "Authorization: Bearer <key>" or "X-API-Key" header.
// Health endpoints (/healthz, /readyz, /metrics) are always exempt.
func (s *Server) SetAPIKey(key string) {
	s.apiKey = key
}

// SetCatalog sets the provider catalog for listing available providers.
func (s *Server) SetCatalog(c *provider.Catalog) {
	s.catalog = c
}

// StartWatcher begins watching the agents directory for file changes.
// Agent change events are broadcast via the /v1/events SSE endpoint.
func (s *Server) StartWatcher() {
	s.watcher = agent.NewWatcher(s.agentsDir, s.logger, func(change agent.AgentChange) {
		var eventType string
		switch change.Type {
		case agent.ChangeCreated:
			eventType = "agent_created"
		case agent.ChangeUpdated:
			eventType = "agent_updated"
		case agent.ChangeDeleted:
			eventType = "agent_deleted"
		default:
			return
		}
		// Non-blocking send.
		select {
		case s.changeCh <- agentChange{Type: eventType, Name: change.Name}:
		default:
		}
	})
	if err := s.watcher.Start(); err != nil {
		s.logger.Error("failed to start agent watcher", "error", err)
	}
}

// StopWatcher stops the file watcher.
func (s *Server) StopWatcher() {
	if s.watcher != nil {
		s.watcher.Stop()
	}
}

// SetAuditStore sets the audit store for audit export.
func (s *Server) SetAuditStore(as *audit.AuditStore) {
	s.auditStore = as
}

// Health returns the health server for adding custom checkers.
func (s *Server) Health() *telemetry.HealthServer {
	return s.health
}

// Handler returns the root Gin engine.
func (s *Server) Handler() *gin.Engine {
	if s.apiKey == "" {
		s.logger.Warn("API key not set — all /v1/ endpoints are unauthenticated; pass --api-key to secure")
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(s.bodySizeLimit(10 << 20)) // 10 MB

	// Health endpoints — always public, no auth required.
	r.GET("/healthz", gin.WrapF(s.health.HandleHealth))
	r.GET("/readyz", gin.WrapF(s.health.HandleReady))
	r.GET("/metrics", gin.WrapF(s.health.HandleMetrics))

	// API routes — protected by auth middleware when apiKey is set.
	v1 := r.Group("/v1", s.authMiddleware())
	v1.POST("/agents/run", s.handleRun)
	v1.POST("/agents/approve", s.handleApprove)
	v1.GET("/tools", s.handleTools)
	v1.GET("/agents", s.handleAgents)
	v1.GET("/agents/:name", s.handleAgentGet)
	v1.PUT("/agents/:name", s.handleAgentPut)
	v1.DELETE("/agents/:name", s.handleAgentDelete)
	v1.POST("/agents/validate", s.handleAgentValidate)
	v1.GET("/mcp", s.handleMCPList)
	v1.GET("/skills", s.handleSkillsList)
	v1.GET("/events", s.handleEvents)

	// Conditional endpoints (auth middleware applies via group).
	if s.store != nil {
		v1.GET("/sessions", s.handleSessionsList)
		v1.GET("/sessions/:id", s.handleSessionsGet)
		v1.DELETE("/sessions/:id", s.handleSessionsDelete)
	}

	if s.eventLogger != nil {
		v1.GET("/sessions/:id/replay", s.handleSessionReplay)
	}

	if s.catalog != nil {
		v1.GET("/providers", s.handleProvidersList)
	}

	if s.auditStore != nil {
		v1.GET("/audit/export", s.handleAuditExport)
	}

	// Static frontend serving (only when embedded).
	if s.staticFS != nil {
		fileServer := http.FileServerFS(s.staticFS)

		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			// API routes — 404.
			if strings.HasPrefix(path, "/v1") || path == "/healthz" {
				c.AbortWithStatus(http.StatusNotFound)
				return
			}
			// Try to serve the file from embedded FS.
			// Strip leading slash for fs lookup.
			name := strings.TrimPrefix(path, "/")
			if name == "" {
				name = "index.html"
			}
			if f, err := s.staticFS.Open(name); err == nil {
				f.Close()
				fileServer.ServeHTTP(c.Writer, c.Request)
				return
			}
			// SPA fallback — serve index.html.
			c.Request.URL.Path = "/"
			fileServer.ServeHTTP(c.Writer, c.Request)
		})
	}

	return r
}
