package httpapi

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/scenario"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/registry"
)

// RunRequest is the HTTP DTO for POST /v1/agents/run.
type RunRequest struct {
	Scenario string            `json:"scenario"`
	Prompt   string            `json:"prompt"`
	Messages []provider.Message `json:"messages,omitempty"`
}

// Server exposes agent HTTP endpoints via Gin.
type Server struct {
	scenarioDir string
	registry    *registry.Registry
	newProvider func(sc *scenario.Scenario) (provider.Provider, error)
	staticFS    fs.FS // optional embedded frontend; nil disables static serving
	logger      *slog.Logger
}

// NewServer creates an HTTP server wiring.
// If staticFS is non-nil, the server also serves the embedded frontend SPA.
func NewServer(scenarioDir string, reg *registry.Registry, newProvider func(sc *scenario.Scenario) (provider.Provider, error), staticFS fs.FS, logger *slog.Logger) *Server {
	if logger == nil {
		logger = slog.Default()
	}
	return &Server{
		scenarioDir: scenarioDir,
		registry:    reg,
		newProvider: newProvider,
		staticFS:    staticFS,
		logger:      logger,
	}
}

// Handler returns the root Gin engine.
func (s *Server) Handler() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())

	// API routes.
	r.GET("/healthz", s.handleHealth)
	r.POST("/v1/agents/run", s.handleRun)
	r.GET("/v1/tools", s.handleTools)
	r.GET("/v1/scenarios", s.handleScenarios)

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

func (s *Server) handleHealth(c *gin.Context) {
	c.String(http.StatusOK, "ok")
}

func (s *Server) handleRun(c *gin.Context) {
	var req RunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_json", "message": err.Error()})
		return
	}
	if req.Scenario == "" || req.Prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "scenario and prompt are required"})
		return
	}

	sc, err := scenario.LoadByName(s.scenarioDir, req.Scenario)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "scenario_error", "message": err.Error()})
		return
	}

	p, err := s.newProvider(sc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "provider_error", "message": err.Error()})
		return
	}

	sess := session.New(sc.Name)
	if len(req.Messages) > 0 {
		sess.SetMessages(req.Messages)
	}
	events, err := loop.Run(c.Request.Context(), loop.Config{
		Provider: p,
		Registry: s.registry,
		Scenario: sc,
		Session:  sess,
		Prompt:   req.Prompt,
		Logger:   s.logger,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "run_error", "message": err.Error()})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "stream_error", "message": "streaming unsupported"})
		return
	}

	s.logger.Info("agent run started", "session_id", sess.ID, "scenario", sc.Name, "provider", sc.Provider, "model", sc.Model)
	for ev := range events {
		data, _ := json.Marshal(ev)
		if _, err := fmt.Fprintf(c.Writer, "data: %s\n\n", data); err != nil {
			return
		}
		flusher.Flush()
	}
}

// ToolInfo is the HTTP DTO for tool information.
type ToolInfo struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

func (s *Server) handleTools(c *gin.Context) {
	tools := s.registry.List()
	result := make([]ToolInfo, len(tools))
	for i, t := range tools {
		result[i] = ToolInfo{
			Name:        t.Name(),
			Description: t.Description(),
			Parameters:  t.InputSchema(),
		}
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) handleScenarios(c *gin.Context) {
	names, err := scenario.ListAvailable(s.scenarioDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "scenario_error", "message": err.Error()})
		return
	}
	if names == nil {
		names = []string{}
	}
	c.JSON(http.StatusOK, names)
}

// NormalizeScenarioName strips optional .yaml suffix.
func NormalizeScenarioName(name string) string {
	return strings.TrimSuffix(name, ".yaml")
}
