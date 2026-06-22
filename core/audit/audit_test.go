package audit

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/teexue/common-agent/core/event"
)

func TestEventLogger_Log(t *testing.T) {
	dir := t.TempDir()
	logger := NewEventLogger(dir)

	rec := EventRecord{
		Timestamp: time.Now(),
		SessionID: "sess-1",
		Agent:     "test",
		Turn:      1,
		Event:     event.Event{Type: event.TypeTextDelta, Content: "hello"},
	}

	if err := logger.Log(rec); err != nil {
		t.Fatal(err)
	}

	// Verify the file was created.
	path := filepath.Join(dir, "sess-1.events.jsonl")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	if len(data) == 0 {
		t.Fatal("expected non-empty events file")
	}

	// Verify it's valid NDJSON.
	var parsed EventRecord
	lines := splitLines(data)
	if len(lines) == 0 {
		t.Fatal("expected at least one line")
	}
	if err := json.Unmarshal(lines[0], &parsed); err != nil {
		t.Fatalf("invalid NDJSON: %v", err)
	}
	if parsed.SessionID != "sess-1" {
		t.Errorf("expected session_id 'sess-1', got %q", parsed.SessionID)
	}
}

func TestEventLogger_MultipleEvents(t *testing.T) {
	dir := t.TempDir()
	logger := NewEventLogger(dir)

	events := []EventRecord{
		{Timestamp: time.Now(), SessionID: "s1", Agent: "test", Turn: 1, Event: event.Event{Type: event.TypeTextDelta, Content: "a"}},
		{Timestamp: time.Now(), SessionID: "s1", Agent: "test", Turn: 1, Event: event.Event{Type: event.TypeToolStart, Tool: "echo"}},
		{Timestamp: time.Now(), SessionID: "s1", Agent: "test", Turn: 1, Event: event.Event{Type: event.TypeDone, Status: "completed"}},
	}

	for _, ev := range events {
		if err := logger.Log(ev); err != nil {
			t.Fatal(err)
		}
	}

	records, err := logger.Replay("s1", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 3 {
		t.Fatalf("expected 3 records, got %d", len(records))
	}
}

func TestEventLogger_Replay_TurnFilter(t *testing.T) {
	dir := t.TempDir()
	logger := NewEventLogger(dir)

	events := []EventRecord{
		{Timestamp: time.Now(), SessionID: "s1", Agent: "test", Turn: 1, Event: event.Event{Type: event.TypeTextDelta, Content: "turn 1"}},
		{Timestamp: time.Now(), SessionID: "s1", Agent: "test", Turn: 2, Event: event.Event{Type: event.TypeTextDelta, Content: "turn 2"}},
		{Timestamp: time.Now(), SessionID: "s1", Agent: "test", Turn: 3, Event: event.Event{Type: event.TypeTextDelta, Content: "turn 3"}},
	}

	for _, ev := range events {
		logger.Log(ev)
	}

	// Filter turn 2 only.
	records, err := logger.Replay("s1", 2, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].Turn != 2 {
		t.Errorf("expected turn 2, got %d", records[0].Turn)
	}
}

func TestEventLogger_Replay_NonexistentSession(t *testing.T) {
	dir := t.TempDir()
	logger := NewEventLogger(dir)

	records, err := logger.Replay("nonexistent", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if records != nil {
		t.Errorf("expected nil for nonexistent session, got %v", records)
	}
}

func TestAuditStore_Save(t *testing.T) {
	dir := t.TempDir()
	store := NewAuditStore(dir)

	rec := AuditRecord{
		Timestamp:  time.Now(),
		SessionID:  "s1",
		Agent:      "test",
		Provider:   "openai",
		Model:      "gpt-4o",
		Turns:      3,
		Status:     "completed",
		ToolCalls:  2,
		DurationMs: 1500,
	}

	if err := store.Save(rec); err != nil {
		t.Fatal(err)
	}

	// Verify file exists.
	path := filepath.Join(dir, "s1.audit.json")
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("audit file not created: %v", err)
	}
}

func TestAuditStore_Query(t *testing.T) {
	dir := t.TempDir()
	store := NewAuditStore(dir)

	now := time.Now()
	records := []AuditRecord{
		{Timestamp: now.Add(-2 * time.Hour), SessionID: "s1", Agent: "agent-a", Status: "completed"},
		{Timestamp: now.Add(-1 * time.Hour), SessionID: "s2", Agent: "agent-b", Status: "completed"},
		{Timestamp: now, SessionID: "s3", Agent: "agent-a", Status: "failed"},
	}

	for _, r := range records {
		store.Save(r)
	}

	// Query all.
	all, err := store.Query(Filter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 3 {
		t.Fatalf("expected 3 records, got %d", len(all))
	}

	// Query by agent.
	agentA, err := store.Query(Filter{Agent: "agent-a"})
	if err != nil {
		t.Fatal(err)
	}
	if len(agentA) != 2 {
		t.Fatalf("expected 2 records for agent-a, got %d", len(agentA))
	}

	// Query with time range.
	recent, err := store.Query(Filter{From: now.Add(-90 * time.Minute)})
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 2 {
		t.Fatalf("expected 2 recent records, got %d", len(recent))
	}

	// Query with pagination.
	page, err := store.Query(Filter{Limit: 1})
	if err != nil {
		t.Fatal(err)
	}
	if len(page) != 1 {
		t.Fatalf("expected 1 record with limit, got %d", len(page))
	}
}

func TestAuditStore_Query_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	store := NewAuditStore(dir)

	results, err := store.Query(Filter{})
	if err != nil {
		t.Fatal(err)
	}
	if results != nil {
		t.Errorf("expected nil for empty dir, got %v", results)
	}
}

func splitLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			lines = append(lines, data[start:i])
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, data[start:])
	}
	return lines
}
