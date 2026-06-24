package telemetry

import (
	"sync"
	"sync/atomic"
	"time"
)

// AgentMetrics tracks per-agent run statistics.
type AgentMetrics struct {
	mu      sync.RWMutex
	agents  map[string]*agentStats
}

type agentStats struct {
	runs       atomic.Int64
	totalMs    atomic.Int64
	lastRun    atomic.Int64 // unix timestamp
	lastStatus atomic.Int32 // 0=idle, 1=running, 2=completed, 3=failed
}

// AgentStatsView is a read-only snapshot of an agent's stats.
type AgentStatsView struct {
	Runs       int64  `json:"runs"`
	TotalMs    int64  `json:"total_ms"`
	AvgMs      int64  `json:"avg_ms"`
	LastRun    string `json:"last_run,omitempty"`
	LastStatus string `json:"last_status"`
}

// NewAgentMetrics creates a new agent metrics tracker.
func NewAgentMetrics() *AgentMetrics {
	return &AgentMetrics{
		agents: make(map[string]*agentStats),
	}
}

func (am *AgentMetrics) getOrCreate(name string) *agentStats {
	am.mu.RLock()
	s, ok := am.agents[name]
	am.mu.RUnlock()
	if ok {
		return s
	}

	am.mu.Lock()
	defer am.mu.Unlock()
	s, ok = am.agents[name]
	if ok {
		return s
	}
	s = &agentStats{}
	am.agents[name] = s
	return s
}

// RecordRunStart records the start of an agent run.
func (am *AgentMetrics) RecordRunStart(agentName string) {
	s := am.getOrCreate(agentName)
	s.lastStatus.Store(1) // running
	s.lastRun.Store(time.Now().Unix())
}

// RecordRunEnd records the end of an agent run.
func (am *AgentMetrics) RecordRunEnd(agentName string, duration time.Duration, success bool) {
	s := am.getOrCreate(agentName)
	s.runs.Add(1)
	s.totalMs.Add(duration.Milliseconds())
	if success {
		s.lastStatus.Store(2) // completed
	} else {
		s.lastStatus.Store(3) // failed
	}
	s.lastRun.Store(time.Now().Unix())
}

// All returns a snapshot of all agent stats.
func (am *AgentMetrics) All() map[string]AgentStatsView {
	am.mu.RLock()
	defer am.mu.RUnlock()

	result := make(map[string]AgentStatsView, len(am.agents))
	for name, s := range am.agents {
		runs := s.runs.Load()
		totalMs := s.totalMs.Load()
		avgMs := int64(0)
		if runs > 0 {
			avgMs = totalMs / runs
		}

		lastRun := ""
		if ts := s.lastRun.Load(); ts > 0 {
			lastRun = time.Unix(ts, 0).Format(time.RFC3339)
		}

		status := "idle"
		switch s.lastStatus.Load() {
		case 1:
			status = "running"
		case 2:
			status = "completed"
		case 3:
			status = "failed"
		}

		result[name] = AgentStatsView{
			Runs:       runs,
			TotalMs:    totalMs,
			AvgMs:      avgMs,
			LastRun:    lastRun,
			LastStatus: status,
		}
	}
	return result
}
