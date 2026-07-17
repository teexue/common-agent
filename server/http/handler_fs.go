package httpapi

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sort"

	"github.com/gin-gonic/gin"
)

// DirEntryInfo is a single directory entry returned by GET /v1/fs/list.
type DirEntryInfo struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"is_dir"`
}

// DirListResponse is the JSON DTO for GET /v1/fs/list.
type DirListResponse struct {
	Path    string         `json:"path"`
	Parent  string         `json:"parent,omitempty"`
	Entries []DirEntryInfo `json:"entries"`
}

func (s *Server) handleFSList(c *gin.Context) {
	raw := c.Query("path")
	abs, err := resolveListPath(raw)
	if err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_path", "api.error.invalid_path", err.Error())
		return
	}

	info, err := os.Stat(abs)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.path_not_found")
			return
		}
		respondErrorDetails(c, http.StatusBadRequest, "fs_error", "api.error.fs_error", err.Error())
		return
	}
	if !info.IsDir() {
		respondError(c, http.StatusBadRequest, "invalid_path", "api.error.not_a_directory")
		return
	}

	entries, err := os.ReadDir(abs)
	if err != nil {
		respondErrorDetails(c, http.StatusForbidden, "fs_error", "api.error.fs_error", err.Error())
		return
	}

	result := make([]DirEntryInfo, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		result = append(result, DirEntryInfo{
			Name:  name,
			Path:  filepath.Join(abs, name),
			IsDir: true,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	parent := filepath.Dir(abs)
	if parent == abs {
		parent = ""
	}

	c.JSON(http.StatusOK, DirListResponse{
		Path:    abs,
		Parent:  parent,
		Entries: result,
	})
}

func resolveListPath(raw string) (string, error) {
	if raw == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return os.Getwd()
		}
		return home, nil
	}
	abs, err := filepath.Abs(raw)
	if err != nil {
		return "", err
	}
	return filepath.Clean(abs), nil
}
