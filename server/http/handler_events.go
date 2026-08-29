package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ApproveRequest is the HTTP DTO for POST /v1/agents/approve.
type ApproveRequest struct {
	ApprovalID string `json:"approval_id"`
	Approved   bool   `json:"approved"`
}

// agentChange is the JSON payload sent to frontend via SSE.
type agentChange struct {
	Type string `json:"type"` // "agent_created" | "agent_updated" | "agent_deleted"
	Name string `json:"name"`
}

func (s *Server) handleEvents(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		respondError(c, http.StatusInternalServerError, "stream_error", "api.error.streaming_unsupported")
		return
	}

	// Send initial ping.
	fmt.Fprintf(c.Writer, "data: {\"type\":\"ping\"}\n\n")
	flusher.Flush()

	// Also wake on server shutdown: otherwise this long-lived SSE connection
	// keeps http.Server.Shutdown blocked until its timeout expires.
	var shutdown <-chan struct{}
	if s.shutdownCtx != nil {
		shutdown = s.shutdownCtx.Done()
	}

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-shutdown:
			return
		case change := <-s.changeCh:
			data, _ := json.Marshal(change)
			if _, err := fmt.Fprintf(c.Writer, "data: %s\n\n", data); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (s *Server) handleApprove(c *gin.Context) {
	var req ApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, errorDetails{Status: http.StatusBadRequest, Code: "invalid_json", MsgKey: "api.error.invalid_json", Details: err.Error()})
		return
	}
	if req.ApprovalID == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "api.error.approval_id_required")
		return
	}

	resolved := s.approver.ResolveApproval(req.ApprovalID, req.Approved)
	if !resolved {
		respondError(c, http.StatusNotFound, "not_found", "api.error.approval_not_found")
		return
	}

	c.JSON(http.StatusOK, gin.H{"resolved": true, "approval_id": req.ApprovalID, "approved": req.Approved})
}
