package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type shellPutRequest struct {
	Shell string `json:"shell"`
}

func (s *Server) handleShellGet(c *gin.Context) {
	view, err := s.svc.GetShellSettings()
	if err != nil {
		respondErrorDetails(c, errorDetails{
			Status: http.StatusInternalServerError, Code: "config_error",
			MsgKey: "api.error.config_error", Details: err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, view)
}

func (s *Server) handleShellPut(c *gin.Context) {
	var req shellPutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{
			Status: http.StatusBadRequest, Code: "invalid_json",
			MsgKey: "api.error.invalid_json", Details: err.Error(),
		})
		return
	}
	view, err := s.svc.SaveShellSettings(req.Shell)
	if err != nil {
		respondServiceError(c, err, errorDetails{
			Status: http.StatusInternalServerError, Code: "config_error",
			MsgKey: "api.error.config_error",
		})
		return
	}
	c.JSON(http.StatusOK, view)
}
