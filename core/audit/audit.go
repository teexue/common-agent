// Package audit provides session event logging and audit trail capabilities.
// Events are persisted as NDJSON files for replay and audit queries.
package audit

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/teexue/common-agent/core/event"
)

// EventRecord wraps an event.Event with metadata for persistence.
type EventRecord struct {
	Timestamp time.Time   `json:"ts"`
	SessionID string      `json:"session_id"`
	Agent     string      `json:"agent"`
	Turn      int         `json:"turn,omitempty"`
	Event     event.Event `json:"event"`
}

// AuditRecord summarizes a completed agent run for audit purposes.
type AuditRecord struct {
	Timestamp  time.Time `json:"ts"`
	SessionID  string    `json:"session_id"`
	Agent      string    `json:"agent"`
	Provider   string    `json:"provider"`
	Model      string    `json:"model"`
	Turns      int       `json:"turns"`
	Status     string    `json:"status"`
	ToolCalls  int       `json:"tool_calls"`
	DurationMs int64     `json:"duration_ms"`
}

// EventLogger writes event records to NDJSON files.
type EventLogger struct {
	dir string
	mu  sync.Mutex
}

// NewEventLogger creates an EventLogger that writes to the given directory.
func NewEventLogger(dir string) *EventLogger {
	return &EventLogger{dir: dir}
}

// Log appends an event record to the session's events file.
func (l *EventLogger) Log(rec EventRecord) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if err := os.MkdirAll(l.dir, 0o755); err != nil {
		return fmt.Errorf("create audit dir: %w", err)
	}

	path := filepath.Join(l.dir, rec.SessionID+".events.jsonl")
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open events file: %w", err)
	}
	defer f.Close()

	data, err := json.Marshal(rec)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}
	data = append(data, '\n')

	if _, err := f.Write(data); err != nil {
		return fmt.Errorf("write event: %w", err)
	}
	return nil
}

// Replay reads events for a session, optionally filtered by turn range.
func (l *EventLogger) Replay(sessionID string, fromTurn, toTurn int) ([]EventRecord, error) {
	path := filepath.Join(l.dir, sessionID+".events.jsonl")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read events file: %w", err)
	}

	var records []EventRecord
	start := 0
	for start < len(data) {
		end := start
		for end < len(data) && data[end] != '\n' {
			end++
		}
		line := data[start:end]
		start = end + 1

		if len(line) == 0 {
			continue
		}

		var rec EventRecord
		if err := json.Unmarshal(line, &rec); err != nil {
			continue // skip malformed lines
		}

		// Apply turn filter.
		if fromTurn > 0 && rec.Turn < fromTurn {
			continue
		}
		if toTurn > 0 && rec.Turn > toTurn {
			continue
		}

		records = append(records, rec)
	}

	return records, nil
}

// AuditStore manages audit records.
type AuditStore struct {
	dir string
	mu  sync.Mutex
}

// NewAuditStore creates an AuditStore.
func NewAuditStore(dir string) *AuditStore {
	return &AuditStore{dir: dir}
}

// Save persists an audit record.
func (s *AuditStore) Save(rec AuditRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return fmt.Errorf("create audit dir: %w", err)
	}

	path := filepath.Join(s.dir, rec.SessionID+".audit.json")
	data, err := json.MarshalIndent(rec, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal audit: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write audit: %w", err)
	}
	return nil
}

// Query returns audit records matching the filter.
func (s *AuditStore) Query(filter Filter) ([]AuditRecord, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read audit dir: %w", err)
	}

	var results []AuditRecord
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}

		path := filepath.Join(s.dir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}

		var rec AuditRecord
		if err := json.Unmarshal(data, &rec); err != nil {
			continue
		}

		if !matchesFilter(rec, filter) {
			continue
		}

		results = append(results, rec)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Timestamp.After(results[j].Timestamp)
	})

	// Apply pagination.
	if filter.Offset > 0 && filter.Offset < len(results) {
		results = results[filter.Offset:]
	}
	if filter.Limit > 0 && filter.Limit < len(results) {
		results = results[:filter.Limit]
	}

	return results, nil
}

// Filter constrains audit queries.
type Filter struct {
	Agent     string
	SessionID string
	From      time.Time
	To        time.Time
	Offset    int
	Limit     int
}

func matchesFilter(rec AuditRecord, f Filter) bool {
	if f.Agent != "" && rec.Agent != f.Agent {
		return false
	}
	if f.SessionID != "" && rec.SessionID != f.SessionID {
		return false
	}
	if !f.From.IsZero() && rec.Timestamp.Before(f.From) {
		return false
	}
	if !f.To.IsZero() && rec.Timestamp.After(f.To) {
		return false
	}
	return true
}

// ExportCSV writes audit records as CSV to the given writer.
func (s *AuditStore) ExportCSV(filter Filter, w interface{ Write([]byte) (int, error) }) error {
	records, err := s.Query(filter)
	if err != nil {
		return err
	}

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Header.
	if err := writer.Write([]string{
		"timestamp", "session_id", "agent", "provider", "model",
		"turns", "status", "tool_calls", "duration_ms",
	}); err != nil {
		return err
	}

	// Rows.
	for _, rec := range records {
		if err := writer.Write([]string{
			rec.Timestamp.Format(time.RFC3339),
			rec.SessionID,
			rec.Agent,
			rec.Provider,
			rec.Model,
			strconv.Itoa(rec.Turns),
			rec.Status,
			strconv.Itoa(rec.ToolCalls),
			strconv.FormatInt(rec.DurationMs, 10),
		}); err != nil {
			return err
		}
	}

	return nil
}
