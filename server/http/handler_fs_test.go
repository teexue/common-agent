package httpapi

import (
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
