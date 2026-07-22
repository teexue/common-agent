package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"unicode"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/mcp"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/skill"
)

// ToolInfo is the HTTP DTO for tool information.
type ToolInfo struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// MCPServerInfo is the JSON DTO for MCP server listing.
type MCPServerInfo struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	Command   string `json:"command,omitempty"`
	URL       string `json:"url,omitempty"`
	Agent     string `json:"agent"`            // agent id/name for agent-scoped servers; "" for global
	Scope     string `json:"scope"`            // "global" | "agent"
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

// ApproveRequest is the HTTP DTO for POST /v1/agents/approve.
type ApproveRequest struct {
	ApprovalID string `json:"approval_id"`
	Approved   bool   `json:"approved"`
}

// agentChange is the JSON payload sent to frontend via SSE.
type agentChange struct {
	Type string `json:"type"` // "agent_created" | "agent_updated" | "agent_deleted"
	Name string `json:"name"`
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

func (s *Server) handleProvidersList(c *gin.Context) {
	if s.catalog == nil {
		c.JSON(http.StatusOK, []provider.ProviderInfo{})
		return
	}
	c.JSON(http.StatusOK, s.catalog.Entries())
}

// handleVendors returns the built-in vendor presets (no secrets).
func (s *Server) handleVendors(c *gin.Context) {
	c.JSON(http.StatusOK, provider.VendorInfos())
}

// handleProviderModels fetches the model list for a configured provider.
// Requires a valid API key to be stored for the provider.
func (s *Server) handleProviderModels(c *gin.Context) {
	if s.catalog == nil {
		respondError(c, http.StatusServiceUnavailable, "no_catalog", "api.error.no_catalog")
		return
	}
	name := c.Param("name")
	if name == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request")
		return
	}
	models, err := s.catalog.ListModels(c.Request.Context(), name)
	if err != nil {
		respondErrorDetails(c, http.StatusBadGateway, "provider_error", "api.error.provider_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, models)
}

// ProviderModelsRequest is the DTO for POST /v1/providers/models.
// It fetches models using inline config (no saved provider required), so the
// UI can pull a model list while creating a provider before saving it.
type ProviderModelsRequest struct {
	Name       string `json:"name,omitempty"`
	APIStyle   string `json:"api_style"`
	BaseURL    string `json:"base_url,omitempty"`
	ModelsPath string `json:"models_path,omitempty"`
	APIVersion string `json:"api_version,omitempty"`
	AuthStyle  string `json:"auth_style,omitempty"`
	APIKey     string `json:"api_key,omitempty"`
}

// handleProviderModelsTest fetches models from an inline provider config.
// If api_key is empty and name matches a saved provider, the stored key is used.
func (s *Server) handleProviderModelsTest(c *gin.Context) {
	var req ProviderModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	style := provider.APIStyle(req.APIStyle)
	if style != provider.StyleOpenAI && style != provider.StyleAnthropic {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request")
		return
	}

	apiKey := req.APIKey
	if apiKey == "" && req.Name != "" && s.catalog != nil {
		if prof, err := s.catalog.Get(req.Name); err == nil {
			apiKey = prof.APIKey
		}
	}
	if apiKey == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request")
		return
	}

	baseURL := req.BaseURL
	modelsPath := req.ModelsPath
	apiVersion := req.APIVersion
	authStyle := provider.AuthStyle(req.AuthStyle)
	if v, ok := provider.LookupVendor(req.Name); ok {
		if baseURL == "" {
			baseURL = v.BaseURLFor(style)
		}
		if modelsPath == "" {
			modelsPath = provider.DefaultModelsPathFor(style)
		}
		if apiVersion == "" {
			apiVersion = v.APIVersion
		}
		if authStyle == "" {
			authStyle = v.AuthForStyle(style)
		}
	}
	if baseURL == "" {
		baseURL = provider.DefaultBaseURLFor(style)
	}
	if modelsPath == "" {
		modelsPath = provider.DefaultModelsPathFor(style)
	}
	if authStyle == "" {
		if style == provider.StyleAnthropic {
			authStyle = provider.AuthXAPIKey
		} else {
			authStyle = provider.AuthBearer
		}
	}

	p, err := provider.NewProvider(provider.ListingProfile(provider.Profile{
		Name:       req.Name,
		APIStyle:   style,
		BaseURL:    baseURL,
		APIKey:     apiKey,
		APIVersion: apiVersion,
		AuthStyle:  authStyle,
		ModelsPath: modelsPath,
	}))
	if err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "provider_error", "api.error.provider_error", err.Error())
		return
	}
	lister, ok := p.(provider.ModelLister)
	if !ok {
		respondErrorDetails(c, http.StatusBadGateway, "provider_error", "api.error.provider_error", "provider does not support model listing")
		return
	}
	models, err := lister.ListModels(c.Request.Context())
	if err != nil {
		respondErrorDetails(c, http.StatusBadGateway, "provider_error", "api.error.provider_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, models)
}

// ProviderUpsertRequest is the DTO for POST/PUT /v1/providers.
type ProviderUpsertRequest struct {
	Name         string `json:"name"`
	APIStyle     string `json:"api_style"`
	BaseURL      string `json:"base_url,omitempty"`
	APIKey       string `json:"api_key,omitempty"`
	APIKeyEnv    string `json:"api_key_env,omitempty"`
	APIVersion   string `json:"api_version,omitempty"`
	AuthStyle    string `json:"auth_style,omitempty"`
	DefaultModel string `json:"default_model,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
	ModelsPath   string `json:"models_path,omitempty"`
	Vision       bool   `json:"vision,omitempty"`
}

func (s *Server) handleProviderUpsert(c *gin.Context) {
	var req ProviderUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	if req.Name == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request")
		return
	}

	home := filepath.Dir(s.agentsDir)
	if req.APIKeyEnv == "" {
		if existing, ok := existingProviderAPIKeyEnv(home, req.Name); ok {
			req.APIKeyEnv = existing
		} else {
			req.APIKeyEnv = defaultAPIKeyEnv(req.Name)
		}
	}

	spec := config.ProviderSpec{
		Name:         req.Name,
		APIStyle:     provider.APIStyle(req.APIStyle),
		BaseURL:      req.BaseURL,
		APIKeyEnv:    req.APIKeyEnv,
		APIVersion:   req.APIVersion,
		AuthStyle:    provider.AuthStyle(req.AuthStyle),
		DefaultModel: req.DefaultModel,
		DisplayName: req.DisplayName,
		ModelsPath:   req.ModelsPath,
		Vision:       req.Vision,
	}
	if err := config.UpsertProvider(home, spec); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "provider_error", "api.error.provider_error", err.Error())
		return
	}

	if req.APIKey != "" {
		if s.creds == nil {
			cs, err := config.NewCredentialStore(home)
			if err != nil {
				respondErrorDetails(c, http.StatusInternalServerError, "provider_error", "api.error.provider_error", err.Error())
				return
			}
			s.creds = cs
		}
		if err := s.creds.Set(req.APIKeyEnv, req.APIKey); err != nil {
			respondErrorDetails(c, http.StatusBadRequest, "provider_error", "api.error.provider_error", err.Error())
			return
		}
	}

	// Reload catalog.
	if err := s.reloadCatalog(); err != nil {
		s.logger.Warn("reload catalog after upsert", "error", err)
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "name": req.Name, "api_key_env": req.APIKeyEnv})
}

func defaultAPIKeyEnv(name string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(name) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	s := strings.Trim(b.String(), "_")
	if s == "" {
		s = "PROVIDER"
	}
	return s + "_API_KEY"
}

func existingProviderAPIKeyEnv(home, name string) (string, bool) {
	data, err := os.ReadFile(config.ProvidersFile(home))
	if err != nil {
		return "", false
	}
	var file provider.CatalogFile
	if err := yaml.Unmarshal(data, &file); err != nil {
		return "", false
	}
	entry, ok := file.Providers[name]
	if !ok || entry.APIKeyEnv == "" {
		return "", false
	}
	return entry.APIKeyEnv, true
}

func (s *Server) handleProviderDelete(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request")
		return
	}

	home := filepath.Dir(s.agentsDir)
	if err := config.DeleteProvider(home, name); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "provider_error", "api.error.provider_error", err.Error())
		return
	}

	// Reload catalog.
	if err := s.reloadCatalog(); err != nil {
		s.logger.Warn("reload catalog after delete", "error", err)
	}

	c.JSON(http.StatusOK, gin.H{"deleted": name})
}

func (s *Server) reloadCatalog() error {
	home := filepath.Dir(s.agentsDir)
	var lookup func(string) string
	if s.creds != nil {
		lookup = s.creds.Lookup
	} else {
		cs, err := config.NewCredentialStore(home)
		if err == nil {
			s.creds = cs
			lookup = cs.Lookup
		}
	}
	cat, err := provider.LoadCatalog(config.ProvidersFile(home), lookup)
	if err != nil {
		return err
	}
	s.SetCatalog(cat)
	return nil
}

func (s *Server) handleMCPList(c *gin.Context) {
	home := filepath.Dir(s.agentsDir)

	var servers []MCPServerInfo

	// Global shared servers.
	if global, err := config.LoadGlobalMCP(home); err != nil {
		s.logger.Warn("log.mcp.load_global", "error", err)
	} else {
		for _, m := range global {
			servers = append(servers, MCPServerInfo{
				Name:    m.Name,
				Type:    m.Type,
				Command: m.Command,
				URL:     m.URL,
				Scope:   "global",
			})
		}
	}

	// Per-agent servers.
	result, err := agent.LoadAll(s.agentsDir)
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "agent_error", "api.error.agent_error", err.Error())
		return
	}
	for _, a := range result.Agents {
		for _, mcp := range a.MCPServers {
			servers = append(servers, MCPServerInfo{
				Name:    mcp.Name,
				Type:    mcp.Type,
				Command: mcp.Command,
				URL:     mcp.URL,
				Agent:   a.Name,
				Scope:   "agent",
			})
		}
	}

	if servers == nil {
		servers = []MCPServerInfo{}
	}
	c.JSON(http.StatusOK, servers)
}

// MCPServerUpsertRequest is the DTO for POST /v1/mcp/global.
type MCPServerUpsertRequest struct {
	Name    string            `json:"name"`
	Type    string            `json:"type"`
	Command string            `json:"command,omitempty"`
	Args    []string          `json:"args,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
	URL     string            `json:"url,omitempty"`
}

func (s *Server) handleMCPGlobalUpsert(c *gin.Context) {
	var req MCPServerUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	if req.Name == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request")
		return
	}

	srv := mcp.ServerConfig{
		Name:    req.Name,
		Type:    req.Type,
		Command: req.Command,
		Args:    req.Args,
		Env:     req.Env,
		URL:     req.URL,
	}
	home := filepath.Dir(s.agentsDir)
	if err := config.UpsertGlobalMCP(home, srv); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "mcp_error", "api.error.mcp_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "name": req.Name})
}

func (s *Server) handleMCPGlobalDelete(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request")
		return
	}
	home := filepath.Dir(s.agentsDir)
	if err := config.DeleteGlobalMCP(home, name); err != nil {
		respondErrorDetails(c, http.StatusNotFound, "not_found", "api.error.mcp_not_found", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": name})
}

func (s *Server) handleSkillsList(c *gin.Context) {
	loader := skill.NewLoader(s.skillsDir)
	skills, err := loader.LoadAll()
	if err != nil {
		s.logger.Warn("log.skill.load_partial", "error", err)
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
		respondError(c, http.StatusServiceUnavailable, "no_audit", "api.error.no_audit")
		return
	}

	format := c.DefaultQuery("format", "json")
	agent := c.Query("agent")

	filter := audit.Filter{
		Agent: agent,
	}

	switch format {
	case "csv":
		var buf bytes.Buffer
		if err := s.auditStore.ExportCSV(filter, &buf); err != nil {
			respondErrorDetails(c, http.StatusInternalServerError, "export_error", "api.error.export_error", err.Error())
			return
		}
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", "attachment; filename=audit-export.csv")
		c.Data(http.StatusOK, "text/csv", buf.Bytes())
	default: // json
		records, err := s.auditStore.Query(filter)
		if err != nil {
			respondErrorDetails(c, http.StatusInternalServerError, "query_error", "api.error.query_error", err.Error())
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
		respondError(c, http.StatusInternalServerError, "stream_error", "api.error.streaming_unsupported")
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

func (s *Server) handleApprove(c *gin.Context) {
	var req ApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	if req.ApprovalID == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.approval_id_required")
		return
	}

	resolved := s.approver.ResolveApproval(req.ApprovalID, req.Approved)
	if !resolved {
		respondError(c, http.StatusNotFound, "not_found", "api.error.approval_not_found")
		return
	}

	c.JSON(http.StatusOK, gin.H{"resolved": true, "approval_id": req.ApprovalID, "approved": req.Approved})
}
