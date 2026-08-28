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
	userID := identityFromGin(c).UserID
	metas, err := s.svc.ListSessions(userID)
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
	userID := identityFromGin(c).UserID
	sess, err := s.svc.LoadSession(id, userID)
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
		"user_id":    sess.UserID,
		"agent":      sess.Agent,
		"title":      sess.GetTitle(),
		"messages":   sess.GetMessages(),
		"metadata":   sess.GetMetadata(),
		"created_at": sess.CreatedAt,
		"updated_at": sess.UpdatedAt,
	})
}

// SessionPatchRequest is the HTTP DTO for PATCH /v1/sessions/:id. Fields left
// null are unchanged.
type SessionPatchRequest struct {
	WorkDir *string `json:"workdir"`
}

func (s *Server) handleSessionPatch(c *gin.Context) {
	if s.store == nil {
		respondError(c, http.StatusServiceUnavailable, "session_error", "api.error.session_not_configured")
		return
	}
	id := c.Param("id")
	userID := identityFromGin(c).UserID
	sess, err := s.svc.LoadSession(id, userID)
	if err != nil {
		if errors.Is(err, session.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.session_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "session_error", "api.error.session_error", err.Error())
		return
	}

	var req SessionPatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}
	if req.WorkDir != nil {
		sess.SetMetadata(session.MetadataKeyWorkdir, *req.WorkDir)
	}
	if err := s.store.Save(sess); err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "session_error", "api.error.session_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": sess.ID, "metadata": sess.GetMetadata()})
}

func (s *Server) handleSessionsDelete(c *gin.Context) {
	if s.store == nil {
		respondError(c, http.StatusServiceUnavailable, "session_error", "api.error.session_not_configured")
		return
	}
	id := c.Param("id")
	userID := identityFromGin(c).UserID
	if err := s.svc.DeleteSession(id, userID); err != nil {
		if errors.Is(err, session.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.session_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "delete_error", "api.error.delete_error", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

// handleAuditRequests returns recent LLM request audit records, newest
// first. Optional filters: session_id, source, limit. Only lightweight
// summaries are returned; full request/response payloads are fetched via
// GET /v1/audit/requests/detail to keep list responses small.
func (s *Server) handleAuditRequests(c *gin.Context) {
	limit := 0
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	records, err := s.requestLogger.Query(audit.RequestFilter{
		SessionID: c.Query("session_id"),
		Source:    c.Query("source"),
		Limit:     limit,
	})
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "audit_error", "api.error.audit_error", err.Error())
		return
	}
	out := make([]audit.RequestSummary, 0, len(records))
	for _, r := range records {
		out = append(out, r.Summary())
	}
	c.JSON(http.StatusOK, out)
}

// handleAuditRequestDetail returns the full request record (including
// request/response payloads) for a single audited LLM call, identified by
// its timestamp string (RFC3339Nano) and optional session_id.
func (s *Server) handleAuditRequestDetail(c *gin.Context) {
	ts := c.Query("ts")
	if ts == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.invalid_request")
		return
	}
	rec, err := s.requestLogger.Find(ts, c.Query("session_id"))
	if err != nil {
		respondError(c, http.StatusNotFound, "not_found", "api.error.audit_error")
		return
	}
	c.JSON(http.StatusOK, rec)
}

func (s *Server) handleSessionReplay(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.session_id_required")
		return
	}
	userID := identityFromGin(c).UserID
	if _, err := s.svc.LoadSession(id, userID); err != nil {
		if errors.Is(err, session.ErrNotFound) {
			respondError(c, http.StatusNotFound, "not_found", "api.error.session_not_found")
			return
		}
		respondErrorDetails(c, http.StatusInternalServerError, "session_error", "api.error.session_error", err.Error())
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
