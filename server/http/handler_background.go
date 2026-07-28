package httpapi

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// allowedBackgroundExts defines image and video extensions accepted for
// background upload. Videos (e.g. mp4) are used as animated wallpapers.
var allowedBackgroundExts = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".webp": "image/webp",
	".gif":  "image/gif",
	".mp4":  "video/mp4",
	".webm": "video/webm",
}

// backgroundGlob is the prefix used to find the stored background file.
const backgroundGlob = "background.*"

// findBackground returns the path to the stored background file, or "" if none.
func findBackground(home string) string {
	matches, err := filepath.Glob(filepath.Join(home, backgroundGlob))
	if err != nil || len(matches) == 0 {
		return ""
	}
	return matches[0]
}

// handleBackgroundGet serves the stored background image or video (or 404).
func (s *Server) handleBackgroundGet(c *gin.Context) {
	home := filepath.Dir(s.agentsDir)
	path := findBackground(home)
	if path == "" {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	ext := strings.ToLower(filepath.Ext(path))
	if ct, ok := allowedBackgroundExts[ext]; ok {
		c.Header("Content-Type", ct)
	}
	c.Header("Cache-Control", "no-cache")
	c.File(path)
}

// handleBackgroundUpload stores an uploaded image or video as the background,
// replacing any existing one.
func (s *Server) handleBackgroundUpload(c *gin.Context) {
	home := filepath.Dir(s.agentsDir)
	file, err := c.FormFile("file")
	if err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if _, ok := allowedBackgroundExts[ext]; !ok {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request")
		return
	}
	if err := os.MkdirAll(home, 0o755); err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "background_error", "api.error.background_error", err.Error())
		return
	}
	// Remove any existing background file before writing the new one.
	if old := findBackground(home); old != "" {
		_ = os.Remove(old)
	}
	dst := filepath.Join(home, "background"+ext)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "background_error", "api.error.background_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": "/v1/background"})
}

// handleBackgroundDelete removes the stored background image or video.
func (s *Server) handleBackgroundDelete(c *gin.Context) {
	home := filepath.Dir(s.agentsDir)
	path := findBackground(home)
	if path == "" {
		c.Status(http.StatusNoContent)
		return
	}
	if err := os.Remove(path); err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "background_error", "api.error.background_error", fmt.Sprintf("remove: %v", err))
		return
	}
	c.Status(http.StatusNoContent)
}
