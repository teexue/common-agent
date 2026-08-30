package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleFSList(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.Mkdir(filepath.Join(dir, "alpha"), 0o755))
	require.NoError(t, os.Mkdir(filepath.Join(dir, "beta"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "file.txt"), []byte("x"), 0o644))

	s := NewServer(ServerConfig{AgentsDir: filepath.Join(dir, "agents")})
	r := s.Handler()

	req := httptest.NewRequest(http.MethodGet, "/v1/fs/list?path="+dir, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp DirListResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, dir, resp.Path)
	require.Len(t, resp.Entries, 2)
	assert.Equal(t, "alpha", resp.Entries[0].Name)
	assert.Equal(t, "beta", resp.Entries[1].Name)
	assert.True(t, resp.Entries[0].IsDir)
}

func TestHandleFSListNotFound(t *testing.T) {
	s := NewServer(ServerConfig{AgentsDir: t.TempDir()})
	r := s.Handler()

	req := httptest.NewRequest(http.MethodGet, "/v1/fs/list?path=/no/such/dir", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleFSMkdir(t *testing.T) {
	dir := t.TempDir()
	s := NewServer(ServerConfig{AgentsDir: filepath.Join(dir, "agents")})
	r := s.Handler()

	body, err := json.Marshal(DirMkdirRequest{Path: dir, Name: "gamma"})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/v1/fs/mkdir", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var resp DirMkdirResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, filepath.Join(dir, "gamma"), resp.Path)
	info, err := os.Stat(resp.Path)
	require.NoError(t, err)
	assert.True(t, info.IsDir())
}

func TestHandleFSMkdirRejects(t *testing.T) {
	dir := t.TempDir()
	s := NewServer(ServerConfig{AgentsDir: dir})
	r := s.Handler()
	require.NoError(t, os.Mkdir(filepath.Join(dir, "taken"), 0o755))

	tests := []struct {
		name   string
		body   DirMkdirRequest
		status int
	}{
		{name: "traversal", body: DirMkdirRequest{Path: dir, Name: ".."}, status: http.StatusBadRequest},
		{name: "slash", body: DirMkdirRequest{Path: dir, Name: "a/b"}, status: http.StatusBadRequest},
		{name: "empty", body: DirMkdirRequest{Path: dir, Name: "  "}, status: http.StatusBadRequest},
		{name: "exists", body: DirMkdirRequest{Path: dir, Name: "taken"}, status: http.StatusConflict},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			raw, err := json.Marshal(tc.body)
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPost, "/v1/fs/mkdir", bytes.NewReader(raw))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			assert.Equal(t, tc.status, w.Code, w.Body.String())
		})
	}
}

func TestHandleFSListNotDirectory(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "file.txt")
	require.NoError(t, os.WriteFile(file, []byte("x"), 0o644))

	s := NewServer(ServerConfig{AgentsDir: dir})
	r := s.Handler()

	req := httptest.NewRequest(http.MethodGet, "/v1/fs/list?path="+file, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
