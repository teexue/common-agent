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
