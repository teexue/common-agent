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
		respondError(c, http.StatusServiceUnavailable, "session_error", "api.error.session_not_configured")
		return
	}
	metas, err := s.svc.ListSessions()
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "session_error", "api.error.session_error", err.Error())
		return
	}
	if metas == nil {
		metas = []session.SessionMeta{}
	}
	c.JSON(http.StatusOK, metas)
}

func (s *Server) handleSessionsGet(c *gin.Context) {
	if s.store == nil {
		respondError(c, http.StatusServiceUnavailable, "session_error", "api.error.session_not_configured")
		return
	}
	id := c.Param("id")
	sess, err := s.svc.LoadSession(id)
	if err != nil {
		if errors.Is(err, session.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.session_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "session_error", "api.error.session_error", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         sess.ID,
		"agent":      sess.Agent,
		"title":      sess.GetTitle(),
		"messages":   sess.GetMessages(),
		"metadata":   sess.GetMetadata(),
		"created_at": sess.CreatedAt,
		"updated_at": sess.UpdatedAt,
	})
}

func (s *Server) handleSessionsDelete(c *gin.Context) {
	if s.store == nil {
		respondError(c, http.StatusServiceUnavailable, "session_error", "api.error.session_not_configured")
		return
	}
	id := c.Param("id")
	if err := s.svc.DeleteSession(id); err != nil {
		if errors.Is(err, session.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.session_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "session_error", "api.error.session_error", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

func (s *Server) handleSessionReplay(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.session_id_required")
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
		respondErrorDetails(c, http.StatusInternalServerError, "replay_error", "api.error.replay_error", err.Error())
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
