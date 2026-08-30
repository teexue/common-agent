package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/service"
)

func (s *Server) handleSubagentGet(c *gin.Context) {
	view, err := s.svc.GetSubagentSettings()
	if err != nil {
		respondErrorDetails(c, errorDetails{
			Status: http.StatusInternalServerError, Code: "config_error",
			MsgKey: "api.error.config_error", Details: err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, view)
}

func (s *Server) handleSubagentPut(c *gin.Context) {
	var view config.SubagentView
	if err := c.ShouldBindJSON(&view); err != nil {
		respondErrorDetails(c, errorDetails{
			Status: http.StatusBadRequest, Code: "invalid_json",
			MsgKey: "api.error.invalid_json", Details: err.Error(),
		})
		return
	}
	if err := s.svc.SaveSubagentSettings(view); err != nil {
		var arg *service.ArgError
		if errors.As(err, &arg) {
			respondErrorDetails(c, errorDetails{
				Status: http.StatusBadRequest, Code: "invalid_request",
				MsgKey: "api.error.invalid_request", Details: arg.Error(),
			})
			return
		}
		respondErrorDetails(c, errorDetails{
			Status: http.StatusInternalServerError, Code: "config_error",
			MsgKey: "api.error.config_error", Details: err.Error(),
		})
		return
	}
	saved, err := s.svc.GetSubagentSettings()
	if err != nil {
		respondErrorDetails(c, errorDetails{
			Status: http.StatusInternalServerError, Code: "config_error",
			MsgKey: "api.error.config_error", Details: err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, saved)
}
