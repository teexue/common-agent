package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/session"
)

func (s *Server) handleSessionsList(c *gin.Context) {
	metas, err := s.store.List()
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
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "session id is required"})
		return
	}

	sess, err := s.store.Load(id)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
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
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_request", "message": "session id is required"})
		return
	}

	if err := s.store.Delete(id); err != nil {
		if errors.Is(err, os.ErrNotExist) {
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

	// Parse optional turn filter.
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

	// Stream as NDJSON.
	c.Header("Content-Type", "application/x-ndjson")
	for _, rec := range records {
		data, _ := json.Marshal(rec)
		c.Writer.Write(data)
		c.Writer.Write([]byte("\n"))
	}
}
