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

		// Check Authorization: Bearer <key>.
		auth := c.GetHeader("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			if strings.TrimPrefix(auth, "Bearer ") == s.apiKey {
				c.Next()
				return
			}
		}

		// Check X-API-Key header.
		if c.GetHeader("X-API-Key") == s.apiKey {
			c.Next()
			return
		}

		c.JSON(http.StatusUnauthorized, gin.H{"code": "unauthorized", "message": "invalid or missing API key"})
		c.Abort()
	}
}
