package httpapi

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

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
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_path", MsgKey: "api.error.invalid_path", Details: err.Error()})
		return
	}

	info, err := os.Stat(abs)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.path_not_found")
			return
		}
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "fs_error", MsgKey: "api.error.fs_error", Details: err.Error()})
		return
	}
	if !info.IsDir() {
		respondError(c, http.StatusBadRequest, "invalid_path", "api.error.not_a_directory")
		return
	}

	entries, err := os.ReadDir(abs)
	if err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusForbidden, Code: "fs_error", MsgKey: "api.error.fs_error", Details: err.Error()})
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

// DirMkdirRequest is the JSON body for POST /v1/fs/mkdir.
type DirMkdirRequest struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

// DirMkdirResponse is the JSON DTO for POST /v1/fs/mkdir.
type DirMkdirResponse struct {
	Path string `json:"path"`
}

func (s *Server) handleFSMkdir(c *gin.Context) {
	var req DirMkdirRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_json", MsgKey: "api.error.invalid_json", Details: err.Error()})
		return
	}
	name, ok := mkdirFolderName(req.Name)
	if !ok {
		respondError(c, http.StatusBadRequest, "invalid_path", "api.error.invalid_dir_name")
		return
	}
	parent, err := resolveListPath(req.Path)
	if err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_path", MsgKey: "api.error.invalid_path", Details: err.Error()})
		return
	}
	child, err := mkdirUnder(parent, name)
	if err != nil {
		writeMkdirError(c, err)
		return
	}
	c.JSON(http.StatusOK, DirMkdirResponse{Path: child})
}

func mkdirFolderName(name string) (string, bool) {
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." {
		return "", false
	}
	if strings.ContainsAny(name, `/\`) || filepath.Base(name) != name {
		return "", false
	}
	return name, true
}

func mkdirUnder(parent, name string) (string, error) {
	info, err := os.Stat(parent)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", errNotDir
	}
	child := filepath.Join(parent, name)
	if filepath.Clean(filepath.Dir(child)) != filepath.Clean(parent) {
		return "", errBadName
	}
	if err := os.Mkdir(child, 0o755); err != nil {
		return "", err
	}
	return child, nil
}

var (
	errNotDir  = errors.New("not a directory")
	errBadName = errors.New("invalid directory name")
)

func writeMkdirError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, os.ErrNotExist):
		respondError(c, http.StatusNotFound, "not_found", "api.error.path_not_found")
	case errors.Is(err, os.ErrExist):
		respondError(c, http.StatusConflict, "dir_exists", "api.error.dir_exists")
	case errors.Is(err, errNotDir):
		respondError(c, http.StatusBadRequest, "invalid_path", "api.error.not_a_directory")
	case errors.Is(err, errBadName):
		respondError(c, http.StatusBadRequest, "invalid_path", "api.error.invalid_dir_name")
	default:
		respondErrorDetails(c, errorDetails{Status: http.StatusForbidden, Code: "fs_error", MsgKey: "api.error.fs_error", Details: err.Error()})
	}
}
