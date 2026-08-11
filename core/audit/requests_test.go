package audit

import (
	"encoding/json"
	"testing"
	"time"
)

func TestRequestLoggerLogAndQuery(t *testing.T) {
	l := NewRequestLogger(t.TempDir())

	recs := []RequestRecord{
		{Timestamp: time.Now().Add(-2 * time.Second), SessionID: "s1", Source: "kanban", Model: "m1", DurationMs: 10, Request: json.RawMessage(`{"a":1}`)},
		{Timestamp: time.Now().Add(-1 * time.Second), SessionID: "s1", Source: "http", Model: "m1", DurationMs: 20},
		{Timestamp: time.Now(), SessionID: "s2", Source: "kanban", Model: "m2", DurationMs: 30, Error: "boom"},
	}
	for _, r := range recs {
		if err := l.Log(r); err != nil {
			t.Fatalf("Log: %v", err)
		}
	}

	all, err := l.Query(RequestFilter{})
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("got %d records, want 3", len(all))
	}
	// Newest first.
	if all[0].SessionID != "s2" {
		t.Fatalf("first record session = %q, want s2", all[0].SessionID)
	}

	bySession, err := l.Query(RequestFilter{SessionID: "s1"})
	if err != nil {
		t.Fatalf("Query by session: %v", err)
	}
	if len(bySession) != 2 {
		t.Fatalf("got %d records for s1, want 2", len(bySession))
	}

	bySource, err := l.Query(RequestFilter{Source: "kanban", Limit: 1})
	if err != nil {
		t.Fatalf("Query by source: %v", err)
	}
	if len(bySource) != 1 || bySource[0].SessionID != "s2" {
		t.Fatalf("unexpected source filter result: %+v", bySource)
	}
}

func TestRequestLoggerQueryEmptyDir(t *testing.T) {
	l := NewRequestLogger(t.TempDir())
	recs, err := l.Query(RequestFilter{})
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	if len(recs) != 0 {
		t.Fatalf("got %d records, want 0", len(recs))
	}
}
