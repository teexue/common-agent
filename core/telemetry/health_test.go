package telemetry

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHealthServer_HandleHealth(t *testing.T) {
	h := NewHealthServer()
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()

	h.HandleHealth(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp HealthResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Status != StatusUp {
		t.Errorf("expected status 'up', got %q", resp.Status)
	}
}

func TestHealthServer_HandleReady_AllUp(t *testing.T) {
	h := NewHealthServer()
	h.AddChecker(NewProviderChecker("test", func(ctx context.Context) error {
		return nil
	}))

	req := httptest.NewRequest("GET", "/readyz", nil)
	w := httptest.NewRecorder()

	h.HandleReady(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHealthServer_HandleReady_OneDown(t *testing.T) {
	h := NewHealthServer()
	h.AddChecker(NewProviderChecker("good", func(ctx context.Context) error {
		return nil
	}))
	h.AddChecker(NewProviderChecker("bad", func(ctx context.Context) error {
		return errors.New("connection refused")
	}))

	req := httptest.NewRequest("GET", "/readyz", nil)
	w := httptest.NewRecorder()

	h.HandleReady(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}

	var resp HealthResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Status != StatusDown {
		t.Errorf("expected status 'down', got %q", resp.Status)
	}
}

func TestHealthServer_HandleReady_NoCheckers(t *testing.T) {
	h := NewHealthServer()
	req := httptest.NewRequest("GET", "/readyz", nil)
	w := httptest.NewRecorder()

	h.HandleReady(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHealthServer_HandleMetrics(t *testing.T) {
	h := NewHealthServer()
	h.IncrActiveSessions()
	h.IncrActiveSessions()

	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()

	h.HandleMetrics(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp MetricsResponse
	json.NewDecoder(w.Body).Decode(&resp)

	if resp.Goroutines < 1 {
		t.Errorf("expected at least 1 goroutine, got %d", resp.Goroutines)
	}
	if resp.ActiveSessions != 2 {
		t.Errorf("expected 2 active sessions, got %d", resp.ActiveSessions)
	}
	if resp.UptimeSeconds < 0 {
		t.Errorf("expected non-negative uptime, got %d", resp.UptimeSeconds)
	}
}

func TestHealthServer_SessionCounting(t *testing.T) {
	h := NewHealthServer()

	h.IncrActiveSessions()
	h.IncrActiveSessions()
	h.DecrActiveSessions()

	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()
	h.HandleMetrics(w, req)

	var resp MetricsResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.ActiveSessions != 1 {
		t.Errorf("expected 1 active session, got %d", resp.ActiveSessions)
	}
}

func TestProviderChecker_NilCheckFn(t *testing.T) {
	c := NewProviderChecker("test", nil)
	if err := c.Check(context.Background()); err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
	if c.Name() != "test" {
		t.Errorf("expected name 'test', got %q", c.Name())
	}
}

func TestShutdownManager_TrackRun(t *testing.T) {
	m := NewShutdownManager()

	m.TrackRun()
	m.TrackRun()
	if m.ActiveRuns() != 2 {
		t.Errorf("expected 2 active runs, got %d", m.ActiveRuns())
	}

	m.UntrackRun()
	if m.ActiveRuns() != 1 {
		t.Errorf("expected 1 active run, got %d", m.ActiveRuns())
	}
}

func TestShutdownManager_Shutdown_WaitsForRuns(t *testing.T) {
	m := NewShutdownManager()
	m.TrackRun()

	go func() {
		time.Sleep(100 * time.Millisecond)
		m.UntrackRun()
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	start := time.Now()
	m.Shutdown(ctx)
	elapsed := time.Since(start)

	if elapsed < 50*time.Millisecond {
		t.Errorf("shutdown returned too quickly: %v", elapsed)
	}
	if m.ActiveRuns() != 0 {
		t.Errorf("expected 0 active runs after shutdown, got %d", m.ActiveRuns())
	}
}

func TestShutdownManager_Shutdown_CallsHandlers(t *testing.T) {
	m := NewShutdownManager()
	called := false
	m.OnShutdown(func(ctx context.Context) {
		called = true
	})

	ctx := context.Background()
	m.Shutdown(ctx)

	if !called {
		t.Error("expected shutdown handler to be called")
	}
}

func TestShutdownManager_Shutdown_Timeout(t *testing.T) {
	m := NewShutdownManager()
	m.TrackRun() // never untrack

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	start := time.Now()
	m.Shutdown(ctx)
	elapsed := time.Since(start)

	if elapsed > 200*time.Millisecond {
		t.Errorf("shutdown took too long: %v", elapsed)
	}
}
