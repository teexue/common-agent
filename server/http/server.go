package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/scenario"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/registry"
)

// RunRequest is the HTTP DTO for POST /v1/agents/run.
type RunRequest struct {
	Scenario string `json:"scenario"`
	Prompt   string `json:"prompt"`
}

// Server exposes agent HTTP endpoints.
type Server struct {
	scenarioDir string
	registry    *registry.Registry
	newProvider func(sc *scenario.Scenario) (provider.Provider, error)
	logger      *slog.Logger
}

// NewServer creates an HTTP server wiring.
func NewServer(scenarioDir string, reg *registry.Registry, newProvider func(sc *scenario.Scenario) (provider.Provider, error), logger *slog.Logger) *Server {
	if logger == nil {
		logger = slog.Default()
	}
	return &Server{
		scenarioDir: scenarioDir,
		registry:    reg,
		newProvider: newProvider,
		logger:      logger,
	}
}

// Handler returns the root HTTP handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("POST /v1/agents/run", s.handleRun)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	var req RunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}
	if req.Scenario == "" || req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "scenario and prompt are required")
		return
	}

	sc, err := scenario.LoadByName(s.scenarioDir, req.Scenario)
	if err != nil {
		writeError(w, http.StatusBadRequest, "scenario_error", err.Error())
		return
	}

	p, err := s.newProvider(sc)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "provider_error", err.Error())
		return
	}

	sess := session.New(sc.Name)
	events, err := loop.Run(r.Context(), loop.Config{
		Provider: p,
		Registry: s.registry,
		Scenario: sc,
		Session:  sess,
		Prompt:   req.Prompt,
		Logger:   s.logger,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "run_error", err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "stream_error", "streaming unsupported")
		return
	}

	s.logger.Info("agent run started", "session_id", sess.ID, "scenario", sc.Name, "provider", sc.Provider, "model", sc.Model)
	for ev := range events {
		data, err := json.Marshal(ev)
		if err != nil {
			continue
		}
		if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
			return
		}
		flusher.Flush()
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"code": code, "message": message})
}

// StreamEvents writes events to w (for CLI reuse).
// Deprecated: use event.StreamEvents instead.
func StreamEvents(ctx context.Context, w io.Writer, events <-chan event.Event) error {
	return event.StreamEvents(ctx, w, events)
}

// PrintEvents prints human-readable events to stdout.
// Deprecated: use event.PrintEvents instead.
func PrintEvents(events <-chan event.Event) {
	event.PrintEvents(events)
}

// NormalizeScenarioName strips optional .yaml suffix.
func NormalizeScenarioName(name string) string {
	return strings.TrimSuffix(name, ".yaml")
}
