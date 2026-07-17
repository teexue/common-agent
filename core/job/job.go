// Package job provides persistent scheduled agent runs (cron / interval / once).
package job

import (
	"crypto/rand"
	"errors"
	"fmt"
	"time"
)

// ErrNotFound is returned when a job does not exist.
var ErrNotFound = errors.New("job not found")

// ScheduleType identifies how a job is scheduled.
type ScheduleType string

const (
	ScheduleCron     ScheduleType = "cron"
	ScheduleInterval ScheduleType = "interval"
	ScheduleOnce     ScheduleType = "once"
)

// SessionMode controls whether each tick reuses a session.
type SessionMode string

const (
	SessionNewEachRun SessionMode = "new_each_run"
	SessionContinue   SessionMode = "continue"
)

// OverlapPolicy controls behavior when a previous run is still active.
type OverlapPolicy string

const (
	OverlapSkip  OverlapPolicy = "skip"
	OverlapQueue OverlapPolicy = "queue"
)

// Schedule describes when a job should run.
type Schedule struct {
	Type     ScheduleType `json:"type" yaml:"type"`
	Cron     string       `json:"cron,omitempty" yaml:"cron,omitempty"`
	Interval Duration     `json:"interval,omitempty" yaml:"interval,omitempty"`
	At       *time.Time   `json:"at,omitempty" yaml:"at,omitempty"` // for once
}

// Policy holds execution constraints for a job.
type Policy struct {
	MaxRuns int           `json:"max_runs" yaml:"max_runs"` // 0 = unlimited
	Timeout Duration      `json:"timeout,omitempty" yaml:"timeout,omitempty"`
	Overlap OverlapPolicy `json:"overlap" yaml:"overlap"`
}

// Status holds runtime state persisted with the job.
type Status struct {
	NextRunAt  *time.Time `json:"next_run_at,omitempty" yaml:"next_run_at,omitempty"`
	LastRunAt  *time.Time `json:"last_run_at,omitempty" yaml:"last_run_at,omitempty"`
	LastStatus string     `json:"last_status,omitempty" yaml:"last_status,omitempty"` // ok | error | skipped
	LastError  string     `json:"last_error,omitempty" yaml:"last_error,omitempty"`
	RunCount   int        `json:"run_count" yaml:"run_count"`
	Running    bool       `json:"running,omitempty" yaml:"running,omitempty"`
}

// Job is a persistent scheduled agent invocation.
type Job struct {
	ID          string      `json:"id" yaml:"id"`
	Name        string      `json:"name" yaml:"name"`
	Enabled     bool        `json:"enabled" yaml:"enabled"`
	Agent       string      `json:"agent" yaml:"agent"`
	Prompt      string      `json:"prompt" yaml:"prompt"`
	WorkDir     string      `json:"workdir,omitempty" yaml:"workdir,omitempty"`
	Schedule    Schedule    `json:"schedule" yaml:"schedule"`
	SessionMode SessionMode `json:"session_mode" yaml:"session_mode"`
	SessionID   string      `json:"session_id,omitempty" yaml:"session_id,omitempty"`
	Policy      Policy      `json:"policy" yaml:"policy"`
	Status      Status      `json:"status" yaml:"status"`
	CreatedAt   time.Time   `json:"created_at" yaml:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" yaml:"updated_at"`
}

// RunRecord is a single execution history entry.
type RunRecord struct {
	ID        string    `json:"id" yaml:"id"`
	JobID     string    `json:"job_id" yaml:"job_id"`
	SessionID string    `json:"session_id,omitempty" yaml:"session_id,omitempty"`
	Status    string    `json:"status" yaml:"status"` // ok | error | skipped
	Error     string    `json:"error,omitempty" yaml:"error,omitempty"`
	StartedAt time.Time `json:"started_at" yaml:"started_at"`
	EndedAt   time.Time `json:"ended_at" yaml:"ended_at"`
}

// Validate checks required fields and schedule consistency.
func (j *Job) Validate() error {
	if j.Name == "" {
		return fmt.Errorf("name is required")
	}
	if j.Agent == "" {
		return fmt.Errorf("agent is required")
	}
	if j.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	switch j.SessionMode {
	case "", SessionNewEachRun, SessionContinue:
	default:
		return fmt.Errorf("invalid session_mode %q", j.SessionMode)
	}
	if j.SessionMode == "" {
		j.SessionMode = SessionNewEachRun
	}
	if j.Policy.Overlap == "" {
		j.Policy.Overlap = OverlapSkip
	}
	switch j.Policy.Overlap {
	case OverlapSkip, OverlapQueue:
	default:
		return fmt.Errorf("invalid overlap policy %q", j.Policy.Overlap)
	}
	return j.Schedule.Validate()
}

// Validate checks schedule fields.
func (s Schedule) Validate() error {
	switch s.Type {
	case ScheduleCron:
		if s.Cron == "" {
			return fmt.Errorf("cron expression is required")
		}
		if _, err := parseCron(s.Cron); err != nil {
			return fmt.Errorf("invalid cron: %w", err)
		}
	case ScheduleInterval:
		if s.Interval.Std() <= 0 {
			return fmt.Errorf("interval must be positive")
		}
	case ScheduleOnce:
		if s.At == nil {
			return fmt.Errorf("at is required for once schedule")
		}
	case "":
		return fmt.Errorf("schedule type is required")
	default:
		return fmt.Errorf("invalid schedule type %q", s.Type)
	}
	return nil
}

// NewID generates a job id.
func NewID() string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("job_%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("job_%x", b)
}

// NewRunID generates a run record id.
func NewRunID() string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("run_%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("run_%x", b)
}
