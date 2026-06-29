package httpapi

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/permission"
)

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

// NormalizeAgentName strips optional .yaml suffix.
func NormalizeAgentName(name string) string {
	return strings.TrimSuffix(name, ".yaml")
}
