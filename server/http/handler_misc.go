package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/audit"
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
	AgentName string `json:"agent"`
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
		c.JSON(http.StatusServiceUnavailable, gin.H{"code": "no_catalog", "message": "provider catalog not configured"})
		return
	}
	c.JSON(http.StatusOK, s.catalog.Entries())
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
		var buf bytes.Buffer
		if err := s.auditStore.ExportCSV(filter, &buf); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": "export_error", "message": err.Error()})
			return
		}
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", "attachment; filename=audit-export.csv")
		c.Data(http.StatusOK, "text/csv", buf.Bytes())
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
