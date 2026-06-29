package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/service"
)

// RunRequest is the HTTP DTO for POST /v1/agents/run.
type RunRequest struct {
	Agent     string             `json:"agent"`
	Prompt    string             `json:"prompt"`
	SessionID string             `json:"session_id,omitempty"`
	Messages  []provider.Message `json:"messages,omitempty"`
	WorkDir   string             `json:"workdir,omitempty"`
}

func (s *Server) handleRun(c *gin.Context) {
	var req RunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "invalid_json", "message": err.Error()})
		return
	}

	result, err := s.svc.PrepareRun(c.Request.Context(), service.RunRequest{
		Agent:     req.Agent,
		Prompt:    req.Prompt,
		SessionID: req.SessionID,
		Messages:  req.Messages,
		WorkDir:   req.WorkDir,
	}, s.approver)
	if err != nil {
		code := "run_error"
		status := http.StatusBadRequest
		if _, ok := err.(*service.ArgError); ok {
			code = "invalid_request"
		} else if _, ok := err.(*service.ServerError); ok {
			code = "provider_error"
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"code": code, "message": err.Error()})
		return
	}

	defer func() {
		if len(result.TempToolNames) > 0 {
			s.registry.UnregisterBatch(result.TempToolNames)
		}
	}()

	runCtx := c.Request.Context()
	if s.shutdownCtx != nil {
		var cancel context.CancelFunc
		runCtx, cancel = mergeContext(s.shutdownCtx, c.Request.Context())
		defer cancel()
	}

	events, err := loop.Run(runCtx, result.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "run_error", "message": err.Error()})
		return
	}

	s.streamEvents(c, events, result.Config.Agent.Name, result.Session.ID)
}

func (s *Server) streamEvents(c *gin.Context, events <-chan event.Event, agentName, sessionID string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "stream_error", "message": "streaming unsupported"})
		return
	}

	s.logger.Info("agent run started", "session_id", sessionID, "agent", agentName)
	runStart := time.Now()
	s.health.AgentMetrics.RecordRunStart(agentName)

	turn := 0
	runSuccess := false
	for ev := range events {
		if s.eventLogger != nil {
			if ev.Type == event.TypeDone || ev.Type == event.TypeError {
				turn++
			}
			_ = s.eventLogger.Log(audit.EventRecord{
				Timestamp: time.Now(), SessionID: sessionID,
				Agent: agentName, Turn: turn, Event: ev,
			})
		}
		if ev.Type == event.TypeDone && ev.Status == "completed" {
			runSuccess = true
		}
		data, _ := json.Marshal(ev)
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
	}

	s.health.AgentMetrics.RecordRunEnd(agentName, time.Since(runStart), runSuccess)
}

// mergeContext returns a context that is cancelled when either a or b is done.
func mergeContext(a, b context.Context) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		select {
		case <-a.Done():
		case <-b.Done():
		}
		cancel()
	}()
	return ctx, cancel
}
