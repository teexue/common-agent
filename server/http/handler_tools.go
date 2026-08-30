package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ToolInfo is the HTTP DTO for tool information.
type ToolInfo struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

func (s *Server) handleTools(c *gin.Context) {
	tools := s.registry.List()
	result := make([]ToolInfo, 0, len(tools))
	for _, t := range tools {
		if t.Name() == "delegate_task" {
			continue
		}
		result = append(result, ToolInfo{
			Name:        t.Name(),
			Description: t.Description(),
			Parameters:  t.InputSchema(),
		})
	}
	c.JSON(http.StatusOK, result)
}
