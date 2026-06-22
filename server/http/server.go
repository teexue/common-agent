package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/registry"
)

// RunRequest is the HTTP DTO for POST /v1/agents/run.
type RunRequest struct {
	Agent     string            `json:"agent"`
	Prompt    string            `json:"prompt"`
	SessionID string            `json:"session_id,omitempty"`
	Messages  []provider.Message `json:"messages,omitempty"`
}

// Server exposes agent HTTP endpoints via Gin.
type Server struct {
	agentsDir   string
	registry    *registry.Registry
	newProvider func(a *agent.Agent) (provider.Provider, error)
	staticFS    fs.FS // optional embedded frontend; nil disables static serving
	logger      *slog.Logger
	store       session.Store   // optional session persistence; nil disables session endpoints
	approver    *HTTPApprover   // handles tool approval flow
	eventLogger *audit.EventLogger // optional event logging; nil disables replay
}

// NewServer creates an HTTP server wiring.
// If staticFS is non-nil, the server also serves the embedded frontend SPA.
// If store is non-nil, session endpoints are enabled.
func NewServer(agentsDir string, reg *registry.Registry, newProvider func(a *agent.Agent) (provider.Provider, error), staticFS fs.FS, logger *slog.Logger, store session.Store) *Server {
	if logger == nil {
		logger = slog.Default()
	}
	return &Server{
		agentsDir:   agentsDir,
		registry:    reg,
		newProvider: newProvider,
		staticFS:    staticFS,
		logger:      logger,
		store:       store,
		approver:    NewHTTPApprover(),
	}
}

// SetEventLogger sets the event logger for session replay.
func (s *Server) SetEventLogger(el *audit.EventLogger) {
	s.eventLogger = el
}

// Handler returns the root Gin engine.
func (s *Server) Handler() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())

	// API routes.
	r.GET("/healthz", s.handleHealth)
	r.POST("/v1/agents/run", s.handleRun)
	r.POST("/v1/agents/approve", s.handleApprove)
	r.GET("/v1/tools", s.handleTools)
	r.GET("/v1/agents", s.handleAgents)
	r.GET("/v1/agents/:name", s.handleAgentGet)
	r.PUT("/v1/agents/:name", s.handleAgentPut)
	r.DELETE("/v1/agents/:name", s.handleAgentDelete)

	// Session endpoints (only when store is configured).
	if s.store != nil {
		r.GET("/v1/sessions", s.handleSessionsList)
		r.GET("/v1/sessions/:id", s.handleSessionsGet)
		r.DELETE("/v1/sessions/:id", s.handleSessionsDelete)
	}

	// Replay endpoint (only when event logger is configured).
	if s.eventLogger != nil {
		r.GET("/v1/sessions/:id/replay", s.handleSessionReplay)
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

func (s *Server) handleHealth(c *gin.Context) {
	c.String(http.StatusOK, "ok")
}

func (s *Server) handleRun(c *gin.Context) {
	var req RunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_json", "message": err.Error()})
		return
	}
	if req.Agent == "" || req.Prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "agent and prompt are required"})
		return
	}

	a, err := agent.LoadByName(s.agentsDir, req.Agent)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "agent_error", "message": err.Error()})
		return
	}

	p, err := s.newProvider(a)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "provider_error", "message": err.Error()})
		return
	}

	sess := session.New(a.Name)
	if len(req.Messages) > 0 {
		sess.SetMessages(req.Messages)
	}

	// Create policy from agent permissions.
	var pol permission.Policy
	if a.Permissions != nil {
		pol = permission.NewAgentPolicy(*a.Permissions)
	} else {
		pol = permission.AllowAllPolicy{}
	}

	loopCfg := loop.Config{
		Provider: p,
		Registry: s.registry,
		Agent:    a,
		Session:  sess,
		Prompt:   req.Prompt,
		Logger:   s.logger,
		Store:    s.store,
		Policy:   pol,
		Approver: s.approver,
	}

	// Support session resume.
	if req.SessionID != "" {
		if s.store == nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": "session_error", "message": "session persistence not configured"})
			return
		}
		if _, err := s.store.Load(req.SessionID); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				c.JSON(http.StatusBadRequest, gin.H{"code": "session_error", "message": "session not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"code": "session_error", "message": err.Error()})
			return
		}
		loopCfg.SessionID = req.SessionID
	}

	events, err := loop.Run(c.Request.Context(), loopCfg)
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

	s.logger.Info("agent run started", "session_id", sess.ID, "agent", a.Name, "provider", a.Provider, "model", a.Model)
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

// AgentListItem is the HTTP DTO for GET /v1/agents.
type AgentListItem struct {
	Name     string   `json:"name"`
	Provider string   `json:"provider"`
	Model    string   `json:"model"`
	Tools    []string `json:"tools"`
	MaxTurns int      `json:"max_turns"`
}

// AgentDetail is the HTTP DTO for GET /v1/agents/:name.
type AgentDetail struct {
	Name          string                  `json:"name"`
	Provider      string                  `json:"provider"`
	Model         string                  `json:"model"`
	SystemPrompt  string                  `json:"system_prompt"`
	Tools         []string                `json:"tools"`
	MaxTurns      int                     `json:"max_turns"`
	MaxTokens     int                     `json:"max_tokens"`
	ToolExecution *agent.ToolExecution    `json:"tool_execution,omitempty"`
	Permissions   *permission.Permissions `json:"permissions,omitempty"`
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

func (s *Server) handleAgents(c *gin.Context) {
	result, err := agent.LoadAll(s.agentsDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "agent_error", "message": err.Error()})
		return
	}
	for _, e := range result.Errors {
		s.logger.Warn("failed to load agent", "name", e.Name, "error", e.Err)
	}

	items := make([]AgentListItem, len(result.Agents))
	for i, a := range result.Agents {
		items[i] = AgentListItem{
			Name:     a.Name,
			Provider: a.Provider,
			Model:    a.Model,
			Tools:    a.Tools,
			MaxTurns: a.MaxTurns,
		}
	}
	c.JSON(http.StatusOK, items)
}

func (s *Server) handleAgentGet(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "agent name is required"})
		return
	}

	a, err := agent.LoadByName(s.agentsDir, NormalizeAgentName(name))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			c.JSON(http.StatusNotFound, gin.H{"code": "not_found", "message": "agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "agent_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, AgentDetail{
		Name:          a.Name,
		Provider:      a.Provider,
		Model:         a.Model,
		SystemPrompt:  a.SystemPrompt,
		Tools:         a.Tools,
		MaxTurns:      a.MaxTurns,
		MaxTokens:     a.MaxTokens,
		ToolExecution: a.ToolExecution,
		Permissions:   a.Permissions,
	})
}

func (s *Server) handleAgentPut(c *gin.Context) {
	name := NormalizeAgentName(c.Param("name"))
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "agent name is required"})
		return
	}

	// Read raw YAML body.
	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": err.Error()})
		return
	}

	// Validate by parsing the YAML.
	a, err := agent.LoadFromBytes(body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_yaml", "message": err.Error()})
		return
	}

	// Ensure the name in the URL matches the name in the YAML.
	if a.Name != name {
		c.JSON(http.StatusBadRequest, gin.H{"code": "name_mismatch", "message": "URL name does not match YAML name"})
		return
	}

	// Write to disk.
	path := filepath.Join(s.agentsDir, name+".yaml")
	if err := os.WriteFile(path, body, 0o644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "write_error", "message": err.Error()})
		return
	}

	s.logger.Info("agent saved", "name", name)
	c.JSON(http.StatusOK, gin.H{"status": "ok", "name": name})
}

func (s *Server) handleAgentDelete(c *gin.Context) {
	name := NormalizeAgentName(c.Param("name"))
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "agent name is required"})
		return
	}

	path := filepath.Join(s.agentsDir, name+".yaml")
	if err := os.Remove(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			c.JSON(http.StatusNotFound, gin.H{"code": "not_found", "message": "agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "delete_error", "message": err.Error()})
		return
	}

	s.logger.Info("agent deleted", "name", name)
	c.JSON(http.StatusOK, gin.H{"status": "ok", "name": name})
}

// ApproveRequest is the HTTP DTO for POST /v1/agents/approve.
type ApproveRequest struct {
	ApprovalID string `json:"approval_id"`
	Approved   bool   `json:"approved"`
}

func (s *Server) handleApprove(c *gin.Context) {
	var req ApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_json", "message": err.Error()})
		return
	}
	if req.ApprovalID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "approval_id is required"})
		return
	}

	resolved := s.approver.ResolveApproval(req.ApprovalID, req.Approved)
	if !resolved {
		c.JSON(http.StatusNotFound, gin.H{"code": "not_found", "message": "no pending approval for approval_id"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"resolved": true, "approval_id": req.ApprovalID, "approved": req.Approved})
}

// NormalizeAgentName strips optional .yaml suffix.
func NormalizeAgentName(name string) string {
	return strings.TrimSuffix(name, ".yaml")
}

func (s *Server) handleSessionsList(c *gin.Context) {
	metas, err := s.store.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "session_error", "message": err.Error()})
		return
	}
	if metas == nil {
		metas = []session.SessionMeta{}
	}
	c.JSON(http.StatusOK, metas)
}

func (s *Server) handleSessionsGet(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "session id is required"})
		return
	}

	sess, err := s.store.Load(id)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			c.JSON(http.StatusNotFound, gin.H{"code": "not_found", "message": "session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "session_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         sess.ID,
		"agent":      sess.Agent,
		"messages":   sess.GetMessages(),
		"metadata":   sess.GetMetadata(),
		"created_at": sess.CreatedAt,
		"updated_at": sess.UpdatedAt,
	})
}

func (s *Server) handleSessionsDelete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "session id is required"})
		return
	}

	if err := s.store.Delete(id); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			c.JSON(http.StatusNotFound, gin.H{"code": "not_found", "message": "session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "session_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

func (s *Server) handleSessionReplay(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "session id is required"})
		return
	}

	// Parse optional turn filter.
	fromTurn := 0
	toTurn := 0
	if v := c.Query("from_turn"); v != "" {
		fmt.Sscanf(v, "%d", &fromTurn)
	}
	if v := c.Query("to_turn"); v != "" {
		fmt.Sscanf(v, "%d", &toTurn)
	}

	records, err := s.eventLogger.Replay(id, fromTurn, toTurn)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "replay_error", "message": err.Error()})
		return
	}

	if records == nil {
		records = []audit.EventRecord{}
	}

	// Stream as NDJSON.
	c.Header("Content-Type", "application/x-ndjson")
	for _, rec := range records {
		data, _ := json.Marshal(rec)
		c.Writer.Write(data)
		c.Writer.Write([]byte("\n"))
	}
}
