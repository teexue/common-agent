package httpapi

import (
	"errors"
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/service"
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
	summaries := s.svc.ListAgents()
	items := make([]AgentListItem, len(summaries))
	for i, a := range summaries {
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
	a, err := s.svc.GetAgent(name)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			c.JSON(http.StatusNotFound, gin.H{"code": "not_found", "message": "agent not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"code": "agent_error", "message": err.Error()})
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
	name := c.Param("name")
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": err.Error()})
		return
	}

	if err := s.svc.SaveAgent(name, body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "save_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "name": service.NormalizeAgentName(name)})
}

func (s *Server) handleAgentDelete(c *gin.Context) {
	name := c.Param("name")
	if err := s.svc.DeleteAgent(name); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			c.JSON(http.StatusNotFound, gin.H{"code": "not_found", "message": "agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "delete_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "name": service.NormalizeAgentName(name)})
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
// Deprecated: Use service.NormalizeAgentName instead.
func NormalizeAgentName(name string) string {
	return service.NormalizeAgentName(name)
}
