package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/session"
)

func (s *Server) handleSessionsList(c *gin.Context) {
	if s.store == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"code": "session_error", "message": "session persistence not configured"})
		return
	}
	metas, err := s.svc.ListSessions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "session_error", "message": err.Error()})
		return
	}
	if metas == nil {
		metas = []session.SessionMeta{}
	}
	c.JSON(http.StatusOK, metas)
}

func (s *Server) handleSessionsGet(c *gin.Context) {
	if s.store == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"code": "session_error", "message": "session persistence not configured"})
		return
	}
	id := c.Param("id")
	sess, err := s.svc.LoadSession(id)
	if err != nil {
		if errors.Is(err, session.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "not_found", "message": "session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "session_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         sess.ID,
		"agent":      sess.Agent,
		"messages":   sess.GetMessages(),
		"metadata":   sess.GetMetadata(),
		"created_at": sess.CreatedAt,
		"updated_at": sess.UpdatedAt,
	})
}

func (s *Server) handleSessionsDelete(c *gin.Context) {
	if s.store == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"code": "session_error", "message": "session persistence not configured"})
		return
	}
	id := c.Param("id")
	if err := s.svc.DeleteSession(id); err != nil {
		if errors.Is(err, session.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "not_found", "message": "session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "session_error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

func (s *Server) handleSessionReplay(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "session id is required"})
		return
	}

	fromTurn := 0
	toTurn := 0
	if v := c.Query("from_turn"); v != "" {
		fmt.Sscanf(v, "%d", &fromTurn)
	}
	if v := c.Query("to_turn"); v != "" {
		fmt.Sscanf(v, "%d", &toTurn)
	}

	records, err := s.eventLogger.Replay(id, fromTurn, toTurn)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "replay_error", "message": err.Error()})
		return
	}

	if records == nil {
		records = []audit.EventRecord{}
	}

	c.Header("Content-Type", "application/x-ndjson")
	for _, rec := range records {
		data, _ := json.Marshal(rec)
		c.Writer.Write(data)
		c.Writer.Write([]byte("\n"))
	}
}
