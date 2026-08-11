package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/store"
)

func setupAuthServer(t *testing.T) (*Server, *store.DB) {
	t.Helper()
	srv, dir := setupTestServer(t)
	db, err := store.Open(dir)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	require.NoError(t, srv.SetStateDB(db))
	return srv, db
}

func registerAndToken(t *testing.T, router http.Handler, username, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{
		"username": username, "password": password, "name": username,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var session struct {
		Token string `json:"token"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&session))
	require.NotEmpty(t, session.Token)
	return session.Token
}

func TestAuth_MultipleAPIKeys(t *testing.T) {
	srv, _ := setupAuthServer(t)
	srv.SetAPIKeys([]string{"key-a", "key-b"})
	router := srv.Handler()

	for _, key := range []string{"key-a", "key-b"} {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/v1/tools", nil)
		req.Header.Set("X-API-Key", key)
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "key %s", key)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/tools", nil)
	req.Header.Set("X-API-Key", "key-c")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_EventsQueryParam(t *testing.T) {
	srv, _ := setupAuthServer(t)
	srv.SetAPIKey("sse-secret")
	router := srv.Handler()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/events", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	w = httptest.NewRecorder()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req, _ = http.NewRequestWithContext(ctx, "GET", "/v1/events?api_key=sse-secret", nil)
	router.ServeHTTP(w, req)
	assert.NotEqual(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_StatusPublicAndDataBlocked(t *testing.T) {
	srv, _ := setupAuthServer(t)
	router := srv.Handler()

	// Status is public.
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/auth/status", nil)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var status struct {
		AuthRequired bool `json:"auth_required"`
		HasUsers     bool `json:"has_users"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&status))
	assert.True(t, status.AuthRequired)
	assert.False(t, status.HasUsers)

	// Data endpoints blocked without credentials.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/tools", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/agents", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthKeys_CRUD_JWT(t *testing.T) {
	srv, _ := setupAuthServer(t)
	router := srv.Handler()
	token := registerAndToken(t, router, "alice", "secret1")

	// List keys requires auth.
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/auth/keys", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/auth/keys", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var listResp struct {
		Enabled bool               `json:"enabled"`
		Keys    []store.APIKeyInfo `json:"keys"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&listResp))
	assert.True(t, listResp.Enabled)
	assert.Empty(t, listResp.Keys)

	// Create — raw key returned once, no token in the response.
	body, _ := json.Marshal(map[string]any{"name": "ui", "scopes": []string{"agents"}})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/auth/keys", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var raw map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))
	_, hasToken := raw["token"]
	assert.False(t, hasToken, "keys create must not return a JWT")
	var created createAPIKeyResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	assert.NotEmpty(t, created.ID)
	assert.True(t, strings.HasPrefix(created.Key, "ca_"))
	assert.Equal(t, []string{"agents"}, created.Scopes)

	// Raw key authenticates within its scope.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/tools", nil)
	req.Header.Set("X-API-Key", created.Key)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// ...but not outside it.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/fs/list", nil)
	req.Header.Set("X-API-Key", created.Key)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)

	// Add a second key so auth stays enabled after deleting the first.
	body2, _ := json.Marshal(map[string]any{"name": "ui2"})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/auth/keys", bytes.NewReader(body2))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	// Disable the first key — it stops authenticating.
	patchBody, _ := json.Marshal(map[string]any{"enabled": false})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("PATCH", "/v1/auth/keys/"+created.ID, bytes.NewReader(patchBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/tools", nil)
	req.Header.Set("X-API-Key", created.Key)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	// Re-enable, then delete.
	patchBody, _ = json.Marshal(map[string]any{"enabled": true})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("PATCH", "/v1/auth/keys/"+created.ID, bytes.NewReader(patchBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/v1/auth/keys/"+created.ID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/tools", nil)
	req.Header.Set("X-API-Key", created.Key)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_RegisterLoginMultiUser(t *testing.T) {
	srv, db := setupAuthServer(t)
	router := srv.Handler()

	// Register alice — enables auth.
	body, _ := json.Marshal(map[string]string{
		"username": "alice", "password": "secret1", "name": "Alice",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var aliceSession struct {
		Token  string `json:"token"`
		UserID string `json:"user_id"`
		User   struct {
			Username string `json:"username"`
		} `json:"user"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&aliceSession))
	assert.Equal(t, "alice", aliceSession.User.Username)
	assert.NotEmpty(t, aliceSession.Token)

	// Unauthenticated /v1 blocked.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/tools", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	// Alice JWT works.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/tools", nil)
	req.Header.Set("Authorization", "Bearer "+aliceSession.Token)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Bob registration is rejected while open registration is disabled.
	body, _ = json.Marshal(map[string]string{
		"username": "bob", "password": "secret2",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusForbidden, w.Code)

	// Enable open registration, then bob registers as member.
	require.NoError(t, db.SetAllowRegistration(true))
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var bobSession struct {
		Token  string `json:"token"`
		UserID string `json:"user_id"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&bobSession))
	assert.NotEqual(t, aliceSession.UserID, bobSession.UserID)

	// Key management is admin-only: bob (member) gets 403.
	keyBody, _ := json.Marshal(map[string]any{"name": "a1"})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/auth/keys", bytes.NewReader(keyBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+bobSession.Token)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/auth/keys", nil)
	req.Header.Set("Authorization", "Bearer "+bobSession.Token)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)

	// Alice (first user = admin) manages her own keys.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/auth/keys", bytes.NewReader(keyBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+aliceSession.Token)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/auth/keys", nil)
	req.Header.Set("Authorization", "Bearer "+aliceSession.Token)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var aliceKeys struct {
		Keys []store.APIKeyInfo `json:"keys"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&aliceKeys))
	assert.Len(t, aliceKeys.Keys, 1)

	// Login alice again.
	loginBody, _ := json.Marshal(map[string]string{"username": "alice", "password": "secret1"})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/auth/login", bytes.NewReader(loginBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	n, err := db.CountUsersWithPassword()
	require.NoError(t, err)
	assert.Equal(t, int64(2), n)
}
