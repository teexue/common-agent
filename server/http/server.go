package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/skill"
	"github.com/teexue/common-agent/core/telemetry"
	"github.com/teexue/common-agent/tools/registry"
)

// RunRequest is the HTTP DTO for POST /v1/agents/run.
type RunRequest struct {
	Agent     string            `json:"agent"`
	Prompt    string            `json:"prompt"`
	SessionID string            `json:"session_id,omitempty"`
	Messages  []provider.Message `json:"messages,omitempty"`
	WorkDir   string            `json:"workdir,omitempty"` // working directory for file tools
}

// Server exposes agent HTTP endpoints via Gin.
type Server struct {
	agentsDir   string
	skillsDir   string
	registry    *registry.Registry
	newProvider func(a *agent.Agent) (provider.Provider, error)
	staticFS    fs.FS // optional embedded frontend; nil disables static serving
	logger      *slog.Logger
	store       session.Store   // optional session persistence; nil disables session endpoints
	approver    *HTTPApprover   // handles tool approval flow
	eventLogger *audit.EventLogger // optional event logging; nil disables replay
	catalog     *provider.Catalog  // optional provider catalog; nil disables provider listing
	auditStore  *audit.AuditStore  // optional audit store; nil disables audit export
	health      *telemetry.HealthServer
	watcher     *agent.Watcher    // watches agents dir for changes
	shutdownCtx context.Context   // cancelled on server shutdown; nil = no shutdown propagation

	// changeCh broadcasts agent file change events to SSE subscribers.
	changeCh    chan agentChange
}

// agentChange is the JSON payload sent to frontend via SSE.
type agentChange struct {
	Type string `json:"type"` // "agent_created" | "agent_updated" | "agent_deleted"
	Name string `json:"name"`
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
		skillsDir:   filepath.Join(filepath.Dir(agentsDir), "skills"),
		registry:    reg,
		newProvider: newProvider,
		staticFS:    staticFS,
		logger:      logger,
		store:       store,
		approver:    NewHTTPApprover(),
		health:      telemetry.NewHealthServer(),
		changeCh:    make(chan agentChange, 16),
	}
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
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())

	// API routes.
	r.GET("/healthz", gin.WrapF(s.health.HandleHealth))
	r.GET("/readyz", gin.WrapF(s.health.HandleReady))
	r.GET("/metrics", gin.WrapF(s.health.HandleMetrics))
	r.POST("/v1/agents/run", s.handleRun)
	r.POST("/v1/agents/approve", s.handleApprove)
	r.GET("/v1/tools", s.handleTools)
	r.GET("/v1/agents", s.handleAgents)
	r.GET("/v1/agents/:name", s.handleAgentGet)
	r.PUT("/v1/agents/:name", s.handleAgentPut)
	r.DELETE("/v1/agents/:name", s.handleAgentDelete)
	r.POST("/v1/agents/validate", s.handleAgentValidate)

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

	// Provider listing (only when catalog is configured).
	if s.catalog != nil {
		r.GET("/v1/providers", s.handleProvidersList)
	}

	// MCP server listing (reads from agent configs).
	r.GET("/v1/mcp", s.handleMCPList)

	// Skills listing.
	r.GET("/v1/skills", s.handleSkillsList)

	// Audit export (only when audit store is configured).
	if s.auditStore != nil {
		r.GET("/v1/audit/export", s.handleAuditExport)
	}

	// SSE event stream for real-time notifications.
	r.GET("/v1/events", s.handleEvents)

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

	// Load skills and inject their instructions into the system prompt.
	_, skillToolNames := s.injectSkills(a)

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
		WorkDir:  req.WorkDir,
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

	// Use shutdown context so the loop stops on server shutdown, not just client disconnect.
	runCtx := c.Request.Context()
	if s.shutdownCtx != nil {
		var cancel context.CancelFunc
		runCtx, cancel = mergeContext(s.shutdownCtx, c.Request.Context())
		defer cancel()
	}
	events, err := loop.Run(runCtx, loopCfg)

	// Clean up temporarily registered skill tools.
	if len(skillToolNames) > 0 {
		s.registry.UnregisterBatch(skillToolNames)
	}

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
	runStart := time.Now()
	s.health.AgentMetrics.RecordRunStart(a.Name)

	turn := 0
	runSuccess := false
	for ev := range events {
		// Log event to audit logger if configured.
		if s.eventLogger != nil {
			if ev.Type == event.TypeDone || ev.Type == event.TypeError {
				turn++
			}
			_ = s.eventLogger.Log(audit.EventRecord{
				Timestamp: time.Now(),
				SessionID: sess.ID,
				Agent:     a.Name,
				Turn:      turn,
				Event:     ev,
			})
		}

		// Track success for metrics.
		if ev.Type == event.TypeDone && ev.Status == "completed" {
			runSuccess = true
		}

		data, _ := json.Marshal(ev)
		if _, err := fmt.Fprintf(c.Writer, "data: %s\n\n", data); err != nil {
			return
		}
		flusher.Flush()
	}

	// Record run metrics.
	s.health.AgentMetrics.RecordRunEnd(a.Name, time.Since(runStart), runSuccess)
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

func (s *Server) handleProvidersList(c *gin.Context) {
	if s.catalog == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"code": "no_catalog", "message": "provider catalog not configured"})
		return
	}
	c.JSON(http.StatusOK, s.catalog.Entries())
}

// MCPServerInfo is the JSON DTO for MCP server listing.
type MCPServerInfo struct {
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	Command   string   `json:"command,omitempty"`
	URL       string   `json:"url,omitempty"`
	AgentName string   `json:"agent"`
}

func (s *Server) handleMCPList(c *gin.Context) {
	result, err := agent.LoadAll(s.agentsDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "agent_error", "message": err.Error()})
		return
	}

	var servers []MCPServerInfo
	for _, a := range result.Agents {
		for _, mcp := range a.MCPServers {
			servers = append(servers, MCPServerInfo{
				Name:      mcp.Name,
				Type:      mcp.Type,
				Command:   mcp.Command,
				URL:       mcp.URL,
				AgentName: a.Name,
			})
		}
	}

	if servers == nil {
		servers = []MCPServerInfo{}
	}
	c.JSON(http.StatusOK, servers)
}

// injectSkills loads skills and injects their instructions into the agent's
// system prompt. For legacy skills with tool definitions, the tools are
// temporarily registered in the registry. Returns the names of temporarily
// registered tools (for cleanup after the run).
func (s *Server) injectSkills(a *agent.Agent) (loadedSkills []*skill.Skill, tempToolNames []string) {
	loader := skill.NewLoader(s.skillsDir)
	allSkills, err := loader.LoadAll()
	if err != nil {
		s.logger.Warn("some skills failed to load", "error", err)
	}
	if len(allSkills) == 0 {
		return nil, nil
	}

	// Filter skills: if agent declares specific skills, use those; otherwise use all.
	var selected []*skill.Skill
	if len(a.Skills) > 0 {
		byName := make(map[string]*skill.Skill, len(allSkills))
		for _, sk := range allSkills {
			byName[sk.Name] = sk
		}
		for _, name := range a.Skills {
			if sk, ok := byName[name]; ok {
				selected = append(selected, sk)
			} else {
				s.logger.Warn("skill not found", "agent", a.Name, "skill", name)
			}
		}
	} else {
		selected = allSkills
	}

	if len(selected) == 0 {
		return nil, nil
	}

	// Inject skill instructions into the system prompt.
	var skillSections []string
	for _, sk := range selected {
		body := sk.Body()
		if body != "" {
			skillSections = append(skillSections, fmt.Sprintf("[[skill:%s]]\n%s", sk.Name, body))
		}

		// Register legacy skill tools temporarily.
		if sk.LegacyManifest != nil {
			tools := skill.Tools(sk)
			for _, t := range tools {
				if err := s.registry.Register(t); err != nil {
					s.logger.Warn("failed to register skill tool", "skill", sk.Name, "tool", t.Name(), "error", err)
					continue
				}
				tempToolNames = append(tempToolNames, t.Name())
			}
		}
	}

	if len(skillSections) > 0 {
		a.SystemPrompt += "\n\n# Available Skills\n\n" + strings.Join(skillSections, "\n\n")
	}

	// Add skill tool names to the agent's tool list so the loop includes them.
	if len(tempToolNames) > 0 {
		existing := make(map[string]bool, len(a.Tools))
		for _, t := range a.Tools {
			existing[t] = true
		}
		for _, t := range tempToolNames {
			if !existing[t] {
				a.Tools = append(a.Tools, t)
			}
		}
	}

	return selected, tempToolNames
}

// SkillInfo is the JSON DTO for skill listing.
type SkillInfo struct {
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	Format      string   `json:"format"`
	Author      string   `json:"author,omitempty"`
	Tools       []string `json:"tools"`
}

func (s *Server) handleSkillsList(c *gin.Context) {
	loader := skill.NewLoader(s.skillsDir)
	skills, err := loader.LoadAll()
	if err != nil {
		s.logger.Warn("some skills failed to load", "error", err)
	}

	result := make([]SkillInfo, 0, len(skills))
	for _, sk := range skills {
		var author string
		if sk.MDManifest != nil {
			author = sk.MDManifest.Frontmatter.Metadata["author"]
		} else if sk.LegacyManifest != nil {
			author = sk.LegacyManifest.Author
		}
		tools := sk.ToolNames()
		if tools == nil {
			tools = []string{}
		}
		result = append(result, SkillInfo{
			Name:        sk.Name,
			Version:     sk.Version,
			Description: sk.Description,
			Format:      sk.Format,
			Author:      author,
			Tools:       tools,
		})
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) handleAuditExport(c *gin.Context) {
	if s.auditStore == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"code": "no_audit", "message": "audit store not configured"})
		return
	}

	format := c.DefaultQuery("format", "json")
	agent := c.Query("agent")

	filter := audit.Filter{
		Agent: agent,
	}

	switch format {
	case "csv":
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", "attachment; filename=audit-export.csv")
		if err := s.auditStore.ExportCSV(filter, c.Writer); err != nil {
			// Headers already sent, can't change status code.
			s.logger.Error("csv export error", "error", err)
		}
	default: // json
		records, err := s.auditStore.Query(filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": "query_error", "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, records)
	}
}

func (s *Server) handleEvents(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "stream_error", "message": "streaming unsupported"})
		return
	}

	// Send initial ping.
	fmt.Fprintf(c.Writer, "data: {\"type\":\"ping\"}\n\n")
	flusher.Flush()

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case change := <-s.changeCh:
			data, _ := json.Marshal(change)
			if _, err := fmt.Fprintf(c.Writer, "data: %s\n\n", data); err != nil {
				return
			}
			flusher.Flush()
		}
	}
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

func (s *Server) handleAgentValidate(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "cannot read body"})
		return
	}

	a, err := agent.LoadFromBytes(body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"valid":   false,
			"message": err.Error(),
		})
		return
	}

	// Validate that all referenced tools exist in the registry.
	if err := s.registry.ValidateTools(a.Tools); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"valid":   false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid": true,
		"name":  a.Name,
	})
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

// mergeContext returns a context that is cancelled when either a or b is done.
func mergeContext(a, b context.Context) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		select {
		case <-a.Done():
		case <-b.Done():
		}
		cancel()
	}()
	return ctx, cancel
}
