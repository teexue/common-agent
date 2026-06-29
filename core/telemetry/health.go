// Package telemetry provides observability and health check capabilities.
package telemetry

import (
	"context"
	"encoding/json"
	"net/http"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

// Status represents the health status.
type Status string

const (
	StatusUp   Status = "up"
	StatusDown Status = "down"
)

// HealthResponse is the JSON response for health endpoints.
type HealthResponse struct {
	Status  Status          `json:"status"`
	Details json.RawMessage `json:"details,omitempty"`
}

// ComponentHealth reports the health of a single component.
type ComponentHealth struct {
	Name   string `json:"name"`
	Status Status `json:"status"`
	Error  string `json:"error,omitempty"`
}

// Checker checks the health of a component.
type Checker interface {
	Name() string
	Check(ctx context.Context) error
}

// HealthServer provides health and readiness endpoints.
type HealthServer struct {
	checkers []Checker
	mu       sync.RWMutex

	// Runtime metrics.
	activeSessions atomic.Int64
	startTime      time.Time

	// Per-agent metrics.
	AgentMetrics *AgentMetrics
}

// NewHealthServer creates a HealthServer.
func NewHealthServer() *HealthServer {
	return &HealthServer{
		startTime:    time.Now(),
		AgentMetrics: NewAgentMetrics(),
	}
}

// AddChecker adds a health checker.
func (h *HealthServer) AddChecker(c Checker) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checkers = append(h.checkers, c)
}

// IncrActiveSessions increments the active session count.
func (h *HealthServer) IncrActiveSessions() {
	h.activeSessions.Add(1)
}

// DecrActiveSessions decrements the active session count.
func (h *HealthServer) DecrActiveSessions() {
	h.activeSessions.Add(-1)
}

// HandleHealth handles GET /healthz — always returns 200 if the process is alive.
func (h *HealthServer) HandleHealth(w http.ResponseWriter, r *http.Request) {
	resp := HealthResponse{Status: StatusUp}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// HandleReady handles GET /readyz — checks all registered components.
func (h *HealthServer) HandleReady(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	checkers := make([]Checker, len(h.checkers))
	copy(checkers, h.checkers)
	h.mu.RUnlock()

	var components []ComponentHealth
	allUp := true

	for _, c := range checkers {
		ch := ComponentHealth{
			Name:   c.Name(),
			Status: StatusUp,
		}
		if err := c.Check(r.Context()); err != nil {
			ch.Status = StatusDown
			ch.Error = err.Error()
			allUp = false
		}
		components = append(components, ch)
	}

	status := StatusUp
	httpStatus := http.StatusOK
	if !allUp {
		status = StatusDown
		httpStatus = http.StatusServiceUnavailable
	}

	details, _ := json.Marshal(components)
	resp := HealthResponse{Status: status, Details: details}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	json.NewEncoder(w).Encode(resp)
}

// MetricsResponse is the JSON response for /metrics.
type MetricsResponse struct {
	Goroutines      int                        `json:"goroutines"`
	HeapAllocBytes  uint64                     `json:"heap_alloc_bytes"`
	HeapSysBytes    uint64                     `json:"heap_sys_bytes"`
	ActiveSessions  int64                      `json:"active_sessions"`
	UptimeSeconds   int64                      `json:"uptime_seconds"`
	Agents          map[string]AgentStatsView  `json:"agents,omitempty"`
}

// HandleMetrics handles GET /metrics — returns runtime metrics.
func (h *HealthServer) HandleMetrics(w http.ResponseWriter, r *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	resp := MetricsResponse{
		Goroutines:     runtime.NumGoroutine(),
		HeapAllocBytes: m.HeapAlloc,
		HeapSysBytes:   m.HeapSys,
		ActiveSessions: h.activeSessions.Load(),
		UptimeSeconds:  int64(time.Since(h.startTime).Seconds()),
		Agents:         h.AgentMetrics.All(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ProviderChecker checks if a provider is reachable.
type ProviderChecker struct {
	name    string
	checkFn func(ctx context.Context) error
}

// NewProviderChecker creates a Checker from a function.
func NewProviderChecker(name string, checkFn func(ctx context.Context) error) *ProviderChecker {
	return &ProviderChecker{name: name, checkFn: checkFn}
}

// Name returns the checker name.
func (c *ProviderChecker) Name() string { return c.name }

// Check runs the provider health check function.
func (c *ProviderChecker) Check(ctx context.Context) error {
	if c.checkFn != nil {
		return c.checkFn(ctx)
	}
	return nil
}

// ShutdownManager coordinates graceful shutdown.
type ShutdownManager struct {
	mu       sync.Mutex
	handlers []func(ctx context.Context)
	running  atomic.Int64
}

// NewShutdownManager creates a ShutdownManager.
func NewShutdownManager() *ShutdownManager {
	return &ShutdownManager{}
}

// OnShutdown registers a handler to call during shutdown.
func (m *ShutdownManager) OnShutdown(fn func(ctx context.Context)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.handlers = append(m.handlers, fn)
}

// TrackRun marks a run as active.
func (m *ShutdownManager) TrackRun() {
	m.running.Add(1)
}

// UntrackRun marks a run as completed.
func (m *ShutdownManager) UntrackRun() {
	m.running.Add(-1)
}

// ActiveRuns returns the number of active runs.
func (m *ShutdownManager) ActiveRuns() int64 {
	return m.running.Load()
}

// Shutdown calls all registered handlers and waits for active runs to complete.
func (m *ShutdownManager) Shutdown(ctx context.Context) {
	m.mu.Lock()
	handlers := make([]func(ctx context.Context), len(m.handlers))
	copy(handlers, m.handlers)
	m.mu.Unlock()

	// Call shutdown handlers.
	for _, fn := range handlers {
		fn(ctx)
	}

	// Wait for active runs to complete or context to expire.
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if m.running.Load() == 0 {
				return
			}
		}
	}
}
