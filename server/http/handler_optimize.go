package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/service"
)

// OptimizeRequest is the HTTP DTO for POST /v1/agents/optimize.
// Kind selects the optimizer: "user" (default) or "system".
// Provider/Model optionally pin which model performs the optimization
// (used by the agent editor so an unsaved form's selection is honored).
type OptimizeRequest struct {
	Prompt   string `json:"prompt"`
	Agent    string `json:"agent,omitempty"`
	Kind     string `json:"kind,omitempty"`
	Provider string `json:"provider,omitempty"`
	Model    string `json:"model,omitempty"`
}

// OptimizeResponse is the HTTP DTO returned by POST /v1/agents/optimize.
type OptimizeResponse struct {
	OptimizedPrompt string `json:"optimized_prompt"`
}

func (s *Server) handleOptimizePrompt(c *gin.Context) {
	var req OptimizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_json", MsgKey: "api.error.invalid_json", Details: err.Error()})
		return
	}

	opts := service.OptimizeOptions{Agent: req.Agent, Provider: req.Provider, Model: req.Model}
	var result string
	var err error
	if req.Kind == "system" {
		result, err = s.svc.OptimizeSystemPromptOnce(c.Request.Context(), req.Prompt, opts)
	} else {
		result, err = s.svc.OptimizePrompt(c.Request.Context(), req.Prompt, opts)
	}
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
		respondErrorDetails(c, errorDetails{Status: status, Code: code, MsgKey: msgKey, Details: err.Error()})
		return
	}

	c.JSON(http.StatusOK, OptimizeResponse{OptimizedPrompt: result})
}
