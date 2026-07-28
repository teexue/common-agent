package httpapi

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/auth"
	"github.com/teexue/common-agent/core/store"
)

type createAPIKeyRequest struct {
	Name string `json:"name"`
	Key  string `json:"key"`
}

type createAPIKeyResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Prefix    string `json:"prefix"`
	Token     string `json:"token"`
	UserID    string `json:"user_id"`
	CreatedAt string `json:"created_at"`
}

type tokenRequest struct {
	APIKey string `json:"api_key"`
}

type registerRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// handleAuthStatus is a public probe for the login gate (no credentials required).
func (s *Server) handleAuthStatus(c *gin.Context) {
	enabled, _ := s.authEnabled()
	var hasUsers bool
	if s.stateDB != nil {
		n, err := s.stateDB.CountUsersWithPassword()
		hasUsers = err == nil && n > 0
	}
	c.JSON(http.StatusOK, gin.H{
		"auth_required": enabled,
		"has_users":     hasUsers,
	})
}

// handleAuthRegister creates a password user and returns a login JWT.
func (s *Server) handleAuthRegister(c *gin.Context) {
	if s.stateDB == nil || s.tokens == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	u, err := s.stateDB.CreateUser(req.Username, req.Password, req.Name)
	if err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request", err.Error())
		return
	}
	token, err := s.tokens.IssueLogin(u.ID)
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "auth_error", "api.error.internal", err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"token":   token,
		"user":    u.ToUserInfo(),
		"user_id": u.ID,
	})
}

// handleAuthLogin verifies username/password and returns a login JWT.
func (s *Server) handleAuthLogin(c *gin.Context) {
	if s.stateDB == nil || s.tokens == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	u, err := s.stateDB.AuthenticateUser(req.Username, req.Password)
	if err != nil {
		respondError(c, http.StatusUnauthorized, "unauthorized", "api.error.invalid_credentials")
		return
	}
	token, err := s.tokens.IssueLogin(u.ID)
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "auth_error", "api.error.internal", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"token":   token,
		"user":    u.ToUserInfo(),
		"user_id": u.ID,
	})
}

// handleAuthKeysList returns redacted API keys and auth status.
func (s *Server) handleAuthKeysList(c *gin.Context) {
	if s.stateDB == nil {
		c.JSON(http.StatusOK, gin.H{"enabled": false, "keys": []store.APIKeyInfo{}})
		return
	}
	id := identityFromGin(c)
	keys, err := s.stateDB.ListAPIKeys(id.UserID)
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "auth_error", "api.error.internal", err.Error())
		return
	}
	enabled, _ := s.authEnabled()
	c.JSON(http.StatusOK, gin.H{"enabled": enabled, "keys": keys, "user_id": id.UserID})
}

// handleAuthKeysCreate registers a client-generated key and returns a JWT (never the raw key).
func (s *Server) handleAuthKeysCreate(c *gin.Context) {
	if s.stateDB == nil || s.tokens == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	var req createAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	if strings.TrimSpace(req.Key) == "" {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request", "key is required")
		return
	}
	userID := identityFromGin(c).UserID
	if userID == "" {
		userID = auth.DefaultUserID
	}
	entry, err := s.stateDB.AddAPIKey(userID, req.Name, req.Key)
	if err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request", err.Error())
		return
	}
	token, err := s.tokens.Issue(auth.Identity{UserID: entry.UserID, KeyID: entry.ID})
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "auth_error", "api.error.internal", err.Error())
		return
	}
	c.JSON(http.StatusCreated, createAPIKeyResponse{
		ID:        entry.ID,
		Name:      entry.Name,
		Prefix:    entry.Prefix,
		Token:     token,
		UserID:    entry.UserID,
		CreatedAt: entry.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	})
}

// handleAuthKeysDelete removes an API key by id (revokes JWTs with that kid).
func (s *Server) handleAuthKeysDelete(c *gin.Context) {
	if s.stateDB == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	id := c.Param("id")
	userID := identityFromGin(c).UserID
	if err := s.stateDB.DeleteAPIKey(id, userID); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.auth_key_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "delete_error", "api.error.delete_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "id": id})
}

// handleAuthToken exchanges a raw API key for a JWT.
func (s *Server) handleAuthToken(c *gin.Context) {
	if s.stateDB == nil || s.tokens == nil {
		respondError(c, http.StatusServiceUnavailable, "not_configured", "api.error.auth_keys_not_configured")
		return
	}
	var req tokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	entry, ok, err := s.stateDB.VerifyAPIKey(req.APIKey)
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "auth_error", "api.error.internal", err.Error())
		return
	}
	if !ok {
		// Also accept CLI ephemeral keys.
		if id, ok := s.resolveCLIKey(req.APIKey); ok {
			token, err := s.tokens.Issue(id)
			if err != nil {
				respondErrorDetails(c, http.StatusInternalServerError, "auth_error", "api.error.internal", err.Error())
				return
			}
			c.JSON(http.StatusOK, gin.H{"token": token, "user_id": id.UserID, "key_id": id.KeyID})
			return
		}
		respondError(c, http.StatusUnauthorized, "unauthorized", "api.error.unauthorized")
		return
	}
	token, err := s.tokens.Issue(auth.Identity{UserID: entry.UserID, KeyID: entry.ID})
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "auth_error", "api.error.internal", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user_id": entry.UserID, "key_id": entry.ID})
}

// handleAuthMe returns the current identity and user profile when available.
func (s *Server) handleAuthMe(c *gin.Context) {
	id := identityFromGin(c)
	resp := gin.H{
		"user_id":           id.UserID,
		"key_id":            id.KeyID,
		"password_session":  id.IsPasswordSession(),
		"auth_enabled":      false,
	}
	if enabled, err := s.authEnabled(); err == nil {
		resp["auth_enabled"] = enabled
	}
	if s.stateDB != nil && id.UserID != "" {
		if u, err := s.stateDB.GetUser(id.UserID); err == nil {
			resp["user"] = u.ToUserInfo()
		}
	}
	c.JSON(http.StatusOK, resp)
}
