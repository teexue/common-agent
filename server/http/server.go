package httpapi

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/auth"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/embedding"
	"github.com/teexue/common-agent/core/job"
	"github.com/teexue/common-agent/core/knowledge"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/store"
	"github.com/teexue/common-agent/core/telemetry"
	"github.com/teexue/common-agent/tools/registry"
)

// Server exposes agent HTTP endpoints via Gin.
type Server struct {
	agentsDir   string
	home        string // ~/.common-agent root; skills dirs derive from it
	registry    *registry.Registry
	newProvider func(a *agent.Agent) (provider.Provider, error)
	staticFS    fs.FS // optional embedded frontend; nil disables static serving
	logger      *slog.Logger
	store       session.Store      // optional session persistence; nil disables session endpoints
	svc         *service.Service   // shared business logic
	approver    *HTTPApprover      // handles tool approval flow
	eventLogger *audit.EventLogger // optional event logging; nil disables replay
	catalog     *provider.Catalog          // optional provider catalog; nil disables provider listing
	creds       *config.CredentialStore    // optional credentials for provider upsert/reload
	auditStore  *audit.AuditStore          // optional audit store; nil disables audit export
	health      *telemetry.HealthServer
	watcher     *agent.Watcher  // watches agents dir for changes
	shutdownCtx context.Context // cancelled on server shutdown; nil = no shutdown propagation
	stateDB     *store.DB
	tokens      *auth.TokenService
	cliAPIKeys  []string // raw keys from --api-key (ephemeral, hashed in-memory)
	cliKeyMu    sync.RWMutex
	cliKeyHash  map[string]string // hash -> synthetic key id
	scheduler   *job.Scheduler    // optional job scheduler

	// changeCh broadcasts agent file change events to SSE subscribers.
	changeCh chan agentChange
}

// ServerConfig holds configuration for creating a new HTTP server.
type ServerConfig struct {
	AgentsDir   string
	HomeDir     string
	Registry    *registry.Registry
	NewProvider func(a *agent.Agent) (provider.Provider, error)
	StaticFS    fs.FS
	Logger      *slog.Logger
	Store       session.Store
	Jobs        job.Store
	Knowledge   *knowledge.Manager
	Ingester    *knowledge.Ingester
	Retriever   *knowledge.Retriever
	Embedder    embedding.Embedder
	KnowledgeRuntime *knowledge.Runtime
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
		HomeDir:     cfg.HomeDir,
		Registry:    cfg.Registry,
		NewProvider: cfg.NewProvider,
		Logger:      logger,
		Store:       cfg.Store,
		Jobs:        cfg.Jobs,
		Knowledge:   cfg.Knowledge,
		Ingester:    cfg.Ingester,
		Retriever:   cfg.Retriever,
		Embedder:    cfg.Embedder,
		KnowledgeRuntime: cfg.KnowledgeRuntime,
	})
	return &Server{
		agentsDir:   cfg.AgentsDir,
		home:        filepath.Dir(cfg.AgentsDir),
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

// SetJobStore sets the job store and optionally starts a scheduler.
func (s *Server) SetJobStore(store job.Store) {
	s.svc.Jobs = store
}

// SetScheduler attaches a job scheduler for run-now and background ticks.
func (s *Server) SetScheduler(sched *job.Scheduler) {
	s.scheduler = sched
}

// Service returns the shared business service.
func (s *Server) Service() *service.Service {
	return s.svc
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

// SetStateDB attaches the SQLite store and initializes JWT services.
func (s *Server) SetStateDB(db *store.DB) error {
	s.stateDB = db
	if db == nil {
		s.tokens = nil
		return nil
	}
	secret, err := db.EnsureJWTSecret()
	if err != nil {
		return err
	}
	s.tokens = auth.NewTokenService(secret, s.keyIDActive, s.userIDActive)
	return nil
}

func (s *Server) userIDActive(userID string) bool {
	if s.stateDB == nil || userID == "" {
		return false
	}
	return s.stateDB.HasUser(userID)
}

func (s *Server) keyIDActive(keyID string) bool {
	if s.stateDB != nil && s.stateDB.HasAPIKeyID(keyID) {
		return true
	}
	s.cliKeyMu.RLock()
	defer s.cliKeyMu.RUnlock()
	for _, id := range s.cliKeyHash {
		if id == keyID {
			return true
		}
	}
	return false
}

// SetAPIKey enables authentication with a single ephemeral CLI key.
func (s *Server) SetAPIKey(key string) {
	if key == "" {
		s.SetAPIKeys(nil)
		return
	}
	s.SetAPIKeys([]string{key})
}

// SetAPIKeys replaces ephemeral CLI-sourced API keys (not persisted).
func (s *Server) SetAPIKeys(keys []string) {
	s.cliAPIKeys = append([]string(nil), keys...)
	next := make(map[string]string, len(keys))
	for i, k := range keys {
		if k == "" {
			continue
		}
		next[store.HashAPIKey(k)] = "cli_" + strconv.Itoa(i)
	}
	s.cliKeyMu.Lock()
	s.cliKeyHash = next
	s.cliKeyMu.Unlock()
}

// authEnabled reports whether /v1 requires credentials.
// When a state DB is attached (normal serve), auth is always required so
// unauthenticated clients cannot read data. Tests without a state DB stay open.
func (s *Server) authEnabled() (bool, error) {
	s.cliKeyMu.RLock()
	cliN := len(s.cliKeyHash)
	s.cliKeyMu.RUnlock()
	if cliN > 0 {
		return true, nil
	}
	if s.stateDB != nil {
		return true, nil
	}
	return false, nil
}

// resolveIdentity validates a JWT or raw API key and returns the identity.
func (s *Server) resolveIdentity(token string) (auth.Identity, bool) {
	if token == "" {
		return auth.Identity{}, false
	}
	if s.tokens != nil && auth.LooksLikeJWT(token) {
		id, err := s.tokens.Parse(token)
		if err == nil {
			return id, true
		}
	}
	if s.stateDB != nil {
		entry, ok, err := s.stateDB.VerifyAPIKey(token)
		if err == nil && ok {
			return auth.Identity{UserID: entry.UserID, KeyID: entry.ID}, true
		}
	}
	return s.resolveCLIKey(token)
}

func (s *Server) resolveCLIKey(raw string) (auth.Identity, bool) {
	h := store.HashAPIKey(raw)
	s.cliKeyMu.RLock()
	kid, ok := s.cliKeyHash[h]
	s.cliKeyMu.RUnlock()
	if !ok {
		return auth.Identity{}, false
	}
	return auth.Identity{UserID: auth.DefaultUserID, KeyID: kid}, true
}

// SetCatalog sets the provider catalog for listing available providers.
// Also rewires Service.NewProvider so subsequent runs use the latest catalog.
func (s *Server) SetCatalog(c *provider.Catalog) {
	s.catalog = c
	if c != nil && s.svc != nil {
		s.svc.NewProvider = func(a *agent.Agent) (provider.Provider, error) {
			return c.ResolveForAgent(a.Provider)
		}
	}
}

// SetCredentialStore sets the credential store used when saving provider API keys.
func (s *Server) SetCredentialStore(cs *config.CredentialStore) {
	s.creds = cs
	if s.svc != nil {
		s.svc.Creds = cs
	}
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
		s.logger.Error("log.agent_watcher.start_failed", "error", err)
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
	if enabled, _ := s.authEnabled(); !enabled {
		s.logger.Warn("log.http.api_key_not_set")
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(LocaleMiddleware())
	r.Use(s.bodySizeLimit(10 << 20)) // 10 MB

	// Health endpoints — always public, no auth required.
	r.GET("/healthz", gin.WrapF(s.health.HandleHealth))
	r.GET("/readyz", gin.WrapF(s.health.HandleReady))
	r.GET("/metrics", gin.WrapF(s.health.HandleMetrics))

	// Public auth endpoints (status / register / login / raw-key → JWT).
	r.GET("/v1/auth/status", s.handleAuthStatus)
	r.POST("/v1/auth/register", s.handleAuthRegister)
	r.POST("/v1/auth/login", s.handleAuthLogin)
	r.POST("/v1/auth/token", s.handleAuthToken)

	// API routes — protected when password users or API keys exist.
	v1 := r.Group("/v1", s.authMiddleware())
	v1.GET("/auth/keys", s.handleAuthKeysList)
	v1.POST("/auth/keys", s.handleAuthKeysCreate)
	v1.DELETE("/auth/keys/:id", s.handleAuthKeysDelete)
	v1.GET("/auth/me", s.handleAuthMe)
	v1.POST("/agents/run", s.handleRun)
	v1.POST("/agents/approve", s.handleApprove)
	v1.POST("/agents/optimize", s.handleOptimizePrompt)
	v1.GET("/tools", s.handleTools)
	v1.GET("/agents", s.handleAgents)
	v1.POST("/agents", s.handleAgentCreate)
	v1.GET("/agents/:id", s.handleAgentGet)
	v1.PUT("/agents/:id", s.handleAgentPut)
	v1.DELETE("/agents/:id", s.handleAgentDelete)
	v1.POST("/agents/validate", s.handleAgentValidate)
	v1.GET("/mcp", s.handleMCPList)
	v1.POST("/mcp/global", s.handleMCPGlobalUpsert)
	v1.DELETE("/mcp/global/:name", s.handleMCPGlobalDelete)
	v1.GET("/background", s.handleBackgroundGet)
	v1.HEAD("/background", s.handleBackgroundGet)
	v1.POST("/background", s.handleBackgroundUpload)
	v1.DELETE("/background", s.handleBackgroundDelete)
	v1.GET("/knowledge", s.handleKnowledgeList)
	v1.POST("/knowledge", s.handleKnowledgeCreate)
	v1.POST("/knowledge/search", s.handleKnowledgeSearch)
	v1.GET("/knowledge/:id", s.handleKnowledgeGet)
	v1.PATCH("/knowledge/:id", s.handleKnowledgeUpdate)
	v1.DELETE("/knowledge/:id", s.handleKnowledgeDelete)
	v1.GET("/knowledge/:id/documents", s.handleKnowledgeDocsList)
	v1.POST("/knowledge/:id/documents", s.handleKnowledgeDocUpload)
	v1.DELETE("/knowledge/:id/documents/:docId", s.handleKnowledgeDocDelete)
	v1.POST("/knowledge/:id/reindex", s.handleKnowledgeReindex)
	v1.GET("/embedding", s.handleEmbeddingGet)
	v1.PUT("/embedding", s.handleEmbeddingPut)
	v1.GET("/embedding/vendors", s.handleEmbeddingVendors)
	v1.GET("/skills", s.handleSkillsList)
	v1.POST("/skills", s.handleSkillCreate)
	v1.POST("/skills/install", s.handleSkillsInstall)
	v1.GET("/skills/:name", s.handleSkillGet)
	v1.PUT("/skills/:name", s.handleSkillUpdate)
	v1.DELETE("/skills/:name", s.handleSkillDelete)
	v1.GET("/fs/list", s.handleFSList)
	v1.GET("/events", s.handleEvents)

	// Job endpoints (when job store is configured).
	if s.svc.Jobs != nil {
		v1.GET("/jobs", s.handleJobsList)
		v1.POST("/jobs", s.handleJobsCreate)
		v1.GET("/jobs/:id", s.handleJobsGet)
		v1.PUT("/jobs/:id", s.handleJobsUpdate)
		v1.DELETE("/jobs/:id", s.handleJobsDelete)
		v1.POST("/jobs/:id/pause", s.handleJobsPause)
		v1.POST("/jobs/:id/resume", s.handleJobsResume)
		v1.POST("/jobs/:id/run", s.handleJobsRun)
		v1.GET("/jobs/:id/runs", s.handleJobsRuns)
	}

	// Conditional endpoints (auth middleware applies via group).
	if s.store != nil {
		v1.GET("/sessions", s.handleSessionsList)
		v1.GET("/sessions/:id", s.handleSessionsGet)
		v1.PATCH("/sessions/:id", s.handleSessionPatch)
		v1.DELETE("/sessions/:id", s.handleSessionsDelete)
	}

	if s.eventLogger != nil {
		v1.GET("/sessions/:id/replay", s.handleSessionReplay)
	}

	v1.GET("/vendors", s.handleVendors)
	v1.GET("/providers", s.handleProvidersList)
	v1.POST("/providers", s.handleProviderUpsert)
	v1.DELETE("/providers/:name", s.handleProviderDelete)
	v1.GET("/providers/:name/models", s.handleProviderModels)
	v1.POST("/providers/models", s.handleProviderModelsTest)

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
