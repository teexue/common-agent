package httpapi

import (
	"errors"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type adminCreateUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Role     string `json:"role"`
}

type adminPatchUserRequest struct {
	Role     string `json:"role"`
	Password string `json:"password"`
}

type registrationSettingRequest struct {
	AllowRegistration bool `json:"allow_registration"`
}

func (s *Server) handleAdminUsersList(c *gin.Context) {
	users, err := s.svc.ListUsers()
	if err != nil {
		if respondAuthConfigError(c, err) {
			return
		}
		respondErrorDetails(c, errorDetails{Status: http.StatusInternalServerError, Code: "auth_error", MsgKey: "api.error.internal", Details: err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

func (s *Server) handleAdminUserCreate(c *gin.Context) {
	var req adminCreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_json", MsgKey: "api.error.invalid_json", Details: err.Error()})
		return
	}
	info, err := s.svc.AdminCreateUser(req.Username, req.Password, req.Name, req.Role)
	if err != nil {
		if respondAuthConfigError(c, err) {
			return
		}
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_request", MsgKey: "api.error.invalid_request", Details: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, info)
}

func (s *Server) handleAdminUserPatch(c *gin.Context) {
	var req adminPatchUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_json", MsgKey: "api.error.invalid_json", Details: err.Error()})
		return
	}
	info, err := s.svc.AdminPatchUser(c.Param("id"), req.Role, req.Password)
	if err != nil {
		respondUserMutationError(c, err)
		return
	}
	c.JSON(http.StatusOK, info)
}

func (s *Server) handleAdminUserDelete(c *gin.Context) {
	id := c.Param("id")
	if err := s.svc.AdminDeleteUser(id); err != nil {
		respondUserMutationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "id": id})
}

func respondUserMutationError(c *gin.Context, err error) {
	if respondAuthConfigError(c, err) {
		return
	}
	if errors.Is(err, os.ErrNotExist) {
		respondError(c, http.StatusNotFound, "not_found", "api.error.user_not_found")
		return
	}
	respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_request", MsgKey: "api.error.invalid_request", Details: err.Error()})
}

func (s *Server) handleAdminRegistrationGet(c *gin.Context) {
	allow, err := s.svc.AllowRegistration()
	if err != nil {
		if respondAuthConfigError(c, err) {
			return
		}
		respondErrorDetails(c, errorDetails{Status: http.StatusInternalServerError, Code: "auth_error", MsgKey: "api.error.internal", Details: err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"allow_registration": allow})
}

func (s *Server) handleAdminRegistrationPut(c *gin.Context) {
	var req registrationSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_json", MsgKey: "api.error.invalid_json", Details: err.Error()})
		return
	}
	allow, err := s.svc.SetAllowRegistration(req.AllowRegistration)
	if err != nil {
		if respondAuthConfigError(c, err) {
			return
		}
		respondErrorDetails(c, errorDetails{Status: http.StatusInternalServerError, Code: "auth_error", MsgKey: "api.error.internal", Details: err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"allow_registration": allow})
}
