package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/service"
)

// OptimizeRequest is the HTTP DTO for POST /v1/agents/optimize.
type OptimizeRequest struct {
	Prompt string `json:"prompt"`
	Agent  string `json:"agent,omitempty"`
}

// OptimizeResponse is the HTTP DTO returned by POST /v1/agents/optimize.
type OptimizeResponse struct {
	OptimizedPrompt string `json:"optimized_prompt"`
}

func (s *Server) handleOptimizePrompt(c *gin.Context) {
	var req OptimizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}

	result, err := s.svc.OptimizePrompt(c.Request.Context(), req.Prompt, req.Agent)
	if err != nil {
		code := "optimize_error"
		msgKey := "api.error.optimize_error"
		status := http.StatusBadRequest
		if _, ok := err.(*service.ArgError); ok {
			code = "invalid_request"
			msgKey = "api.error.invalid_request"
		} else if _, ok := err.(*service.ServerError); ok {
			code = "provider_error"
			msgKey = "api.error.provider_error"
			status = http.StatusInternalServerError
		}
		respondErrorDetails(c, status, code, msgKey, err.Error())
		return
	}

	c.JSON(http.StatusOK, OptimizeResponse{OptimizedPrompt: result})
}
