package httpapi

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/store"
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

// handleAdminUsersList returns all users (admin only).
func (s *Server) handleAdminUsersList(c *gin.Context) {
	if s.stateDB == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	users, err := s.stateDB.ListUsers()
	if err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusInternalServerError, Code: "auth_error", MsgKey: "api.error.internal", Details: err.Error()})
		return
	}
	infos := make([]store.UserInfo, 0, len(users))
	for _, u := range users {
		infos = append(infos, u.ToUserInfo())
	}
	c.JSON(http.StatusOK, gin.H{"users": infos})
}

// handleAdminUserCreate creates a user with an explicit role (admin only).
func (s *Server) handleAdminUserCreate(c *gin.Context) {
	if s.stateDB == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	var req adminCreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_json", MsgKey: "api.error.invalid_json", Details: err.Error()})
		return
	}
	u, err := s.stateDB.CreateUser(req.Username, req.Password, req.Name, req.Role)
	if err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_request", MsgKey: "api.error.invalid_request", Details: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, u.ToUserInfo())
}

// handleAdminUserPatch changes a user's role and/or resets the password.
func (s *Server) handleAdminUserPatch(c *gin.Context) {
	if s.stateDB == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	var req adminPatchUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_json", MsgKey: "api.error.invalid_json", Details: err.Error()})
		return
	}
	id := c.Param("id")
	if role := strings.TrimSpace(req.Role); role != "" {
		if err := s.stateDB.UpdateUserRole(id, role); err != nil {
			s.respondUserMutationError(c, err)
			return
		}
	}
	if req.Password != "" {
		if err := s.stateDB.ResetUserPassword(id, req.Password); err != nil {
			s.respondUserMutationError(c, err)
			return
		}
	}
	u, err := s.stateDB.GetUser(id)
	if err != nil {
		s.respondUserMutationError(c, err)
		return
	}
	c.JSON(http.StatusOK, u.ToUserInfo())
}

// handleAdminUserDelete removes a user and their API keys (admin only).
func (s *Server) handleAdminUserDelete(c *gin.Context) {
	if s.stateDB == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	id := c.Param("id")
	if err := s.stateDB.DeleteUser(id); err != nil {
		s.respondUserMutationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "id": id})
}

// respondUserMutationError maps store user-mutation errors to HTTP responses.
func (s *Server) respondUserMutationError(c *gin.Context, err error) {
	if errors.Is(err, os.ErrNotExist) {
		respondError(c, http.StatusNotFound, "not_found", "api.error.user_not_found")
		return
	}
	respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_request", MsgKey: "api.error.invalid_request", Details: err.Error()})
}

// handleAdminRegistrationGet returns the open-registration setting.
func (s *Server) handleAdminRegistrationGet(c *gin.Context) {
	if s.stateDB == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	c.JSON(http.StatusOK, gin.H{"allow_registration": s.stateDB.GetAllowRegistration()})
}

// handleAdminRegistrationPut toggles open self-registration.
func (s *Server) handleAdminRegistrationPut(c *gin.Context) {
	if s.stateDB == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	var req registrationSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_json", MsgKey: "api.error.invalid_json", Details: err.Error()})
		return
	}
	if err := s.stateDB.SetAllowRegistration(req.AllowRegistration); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusInternalServerError, Code: "auth_error", MsgKey: "api.error.internal", Details: err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"allow_registration": s.stateDB.GetAllowRegistration()})
}
