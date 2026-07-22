package httpapi

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// authMiddleware enforces API key authentication for /v1/ routes.
// When s.apiKey is empty, authentication is disabled.
func (s *Server) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if s.apiKey == "" {
			c.Next()
			return
		}

		// Check Authorization: Bearer <key> (case-insensitive scheme per RFC 7235).
		auth := c.GetHeader("Authorization")
		if len(auth) > 7 && strings.EqualFold(auth[:7], "bearer ") {
			if auth[7:] == s.apiKey {
				c.Next()
				return
			}
		}

		// Check X-API-Key header.
		if c.GetHeader("X-API-Key") == s.apiKey {
			c.Next()
			return
		}

		respondError(c, http.StatusUnauthorized, "unauthorized", "api.error.unauthorized")
		c.Abort()
	}
}

// backgroundUploadMaxBytes is the body size limit for POST /v1/background.
// Wallpapers are often larger than the default API payload limit.
const backgroundUploadMaxBytes = 50 << 20 // 50 MB

// bodySizeLimit returns middleware that limits request body size.
// Background image uploads use a higher limit (see backgroundUploadMaxBytes).
func (s *Server) bodySizeLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := maxBytes
		// Middleware runs before route match, so inspect the raw path.
		if c.Request.Method == http.MethodPost && c.Request.URL.Path == "/v1/background" {
			limit = backgroundUploadMaxBytes
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}
