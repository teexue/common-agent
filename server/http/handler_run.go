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

// ImageAttachment is an uploaded image in the run request.
type ImageAttachment struct {
	DataURL string `json:"data_url"`
	Name    string `json:"name,omitempty"`
}

// RunRequest is the HTTP DTO for POST /v1/agents/run.
type RunRequest struct {
	Agent     string             `json:"agent"`
	Prompt    string             `json:"prompt"`
	SessionID string             `json:"session_id,omitempty"`
	Messages  []provider.Message `json:"messages,omitempty"`
	WorkDir   string             `json:"workdir,omitempty"`
	Images    []ImageAttachment  `json:"images,omitempty"`
}

func (s *Server) handleRun(c *gin.Context) {
	var req RunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErrorDetails(c, http.StatusBadRequest, "invalid_json", "api.error.invalid_json", err.Error())
		return
	}

	// Convert images to provider content parts.
	var images []provider.ContentPart
	for _, img := range req.Images {
		images = append(images, provider.ContentPart{
			Type:     "image_url",
			ImageURL: &provider.ImageURL{URL: img.DataURL},
		})
	}

	result, err := s.svc.PrepareRun(c.Request.Context(), service.RunRequest{
		Agent:     req.Agent,
		Prompt:    req.Prompt,
		SessionID: req.SessionID,
		Messages:  req.Messages,
		WorkDir:   req.WorkDir,
		Images:    images,
	}, s.approver)
	if err != nil {
		code := "run_error"
		msgKey := "api.error.run_error"
		status := http.StatusBadRequest
		if _, ok := err.(*service.ArgError); ok {
			code = "invalid_request"
			msgKey = "api.error.invalid_request"
		} else if _, ok := err.(*service.ServerError); ok {
			code = "provider_error"
			msgKey = "api.error.provider_error"
			status = http.StatusInternalServerError
		}
		respondErrorDetails(c, status, code, msgKey, err.Error())
		return
	}

	defer func() {
		result.Cleanup(s.registry)
	}()

	runCtx := c.Request.Context()
	if s.shutdownCtx != nil {
		var cancel context.CancelFunc
		runCtx, cancel = mergeContext(s.shutdownCtx, c.Request.Context())
		defer cancel()
	}

	events, err := loop.Run(runCtx, result.Config)
	if err != nil {
		respondErrorDetails(c, http.StatusInternalServerError, "run_error", "api.error.run_error", err.Error())
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
		respondError(c, http.StatusInternalServerError, "stream_error", "api.error.streaming_unsupported")
		return
	}

	s.logger.Info("log.agent.run_started", "session_id", sessionID, "agent", agentName)
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
