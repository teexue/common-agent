package session_test

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
)

func TestFileStoreSaveAndLoad(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	sess := session.New("test-agent")
	sess.SetMetadata("key", "value")
	sess.AddMessages(
		provider.Message{Role: provider.RoleUser, Content: "hello"},
		provider.Message{Role: provider.RoleAssistant, Content: "hi there"},
	)

	if err := store.Save(sess); err != nil {
		t.Fatalf("Save: %v", err)
	}

	loaded, err := store.Load(sess.ID)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if loaded.ID != sess.ID {
		t.Fatalf("ID = %q, want %q", loaded.ID, sess.ID)
	}
	if loaded.Agent != "test-agent" {
		t.Fatalf("Agent = %q, want test-agent", loaded.Agent)
	}
	if len(loaded.Messages) != 2 {
		t.Fatalf("got %d messages, want 2", len(loaded.Messages))
	}
	if loaded.Messages[0].Content != "hello" {
		t.Fatalf("message[0] = %q, want hello", loaded.Messages[0].Content)
	}
	if loaded.Messages[1].Content != "hi there" {
		t.Fatalf("message[1] = %q, want hi there", loaded.Messages[1].Content)
	}
	meta := loaded.GetMetadata()
	if meta["key"] != "value" {
		t.Fatalf("metadata[key] = %q, want value", meta["key"])
	}
	if loaded.CreatedAt.IsZero() {
		t.Fatal("CreatedAt should not be zero")
	}
	if loaded.UpdatedAt.IsZero() {
		t.Fatal("UpdatedAt should not be zero")
	}
}

func TestFileStoreLoadNotExist(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.Load("nonexistent")
	if !errors.Is(err, session.ErrNotFound) {
		t.Fatalf("expected session.ErrNotFound, got %v", err)
	}
}

func TestFileStoreList(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	// Create 3 sessions.
	for _, name := range []string{"a", "b", "c"} {
		sess := session.New(name)
		sess.AddMessages(provider.Message{Role: provider.RoleUser, Content: name})
		if err := store.Save(sess); err != nil {
			t.Fatalf("Save %s: %v", name, err)
		}
	}

	metas, err := store.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(metas) != 3 {
		t.Fatalf("got %d sessions, want 3", len(metas))
	}
	// Verify all agents are present (order may vary due to same-second timestamps).
	agents := map[string]bool{}
	for _, m := range metas {
		agents[m.Agent] = true
	}
	for _, want := range []string{"a", "b", "c"} {
		if !agents[want] {
			t.Fatalf("missing agent %q in list", want)
		}
	}
}

func TestFileStoreDelete(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	sess := session.New("to-delete")
	if err := store.Save(sess); err != nil {
		t.Fatalf("Save: %v", err)
	}

	if err := store.Delete(sess.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err = store.Load(sess.ID)
	if !errors.Is(err, session.ErrNotFound) {
		t.Fatalf("expected session.ErrNotFound after delete, got %v", err)
	}
}

func TestFileStoreDeleteNotExist(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	err = store.Delete("nonexistent")
	if !errors.Is(err, session.ErrNotFound) {
		t.Fatalf("expected session.ErrNotFound, got %v", err)
	}
}

func TestFileStoreUpsert(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	sess := session.New("demo")
	sess.AddMessages(provider.Message{Role: provider.RoleUser, Content: "first"})
	if err := store.Save(sess); err != nil {
		t.Fatalf("Save: %v", err)
	}

	// Update and save again (upsert).
	sess.AddMessages(provider.Message{Role: provider.RoleAssistant, Content: "second"})
	if err := store.Save(sess); err != nil {
		t.Fatalf("Save (upsert): %v", err)
	}

	loaded, err := store.Load(sess.ID)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(loaded.Messages) != 2 {
		t.Fatalf("got %d messages after upsert, want 2", len(loaded.Messages))
	}
}

func TestFileStoreConcurrency(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sess := session.New("concurrent")
			sess.AddMessages(provider.Message{Role: provider.RoleUser, Content: "msg"})
			if err := store.Save(sess); err != nil {
				t.Errorf("Save: %v", err)
			}
		}()
	}
	wg.Wait()

	metas, err := store.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(metas) != 20 {
		t.Fatalf("got %d sessions, want 20", len(metas))
	}
}

func TestFileStoreCorruptedFile(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	// Write a corrupted JSON file.
	corruptPath := filepath.Join(dir, "corrupt.json")
	if err := os.WriteFile(corruptPath, []byte("{invalid json"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Load should return an error for corrupted files.
	_, err = store.Load("corrupt")
	if err == nil {
		t.Fatal("expected error for corrupted file")
	}

	// List should skip corrupted files gracefully.
	metas, err := store.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(metas) != 0 {
		t.Fatalf("got %d sessions, want 0 (corrupted file should be skipped)", len(metas))
	}
}

func TestFileStoreMessageToolCalls(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	sess := session.New("tool-test")
	sess.AddMessages(provider.Message{
		Role:    provider.RoleAssistant,
		Content: "",
		ToolCalls: []provider.ToolCall{
			{ID: "call_1", Name: "echo", Arguments: json.RawMessage(`{"input":"hello"}`)},
		},
	})
	sess.AddMessages(provider.Message{
		Role:       provider.RoleTool,
		Content:    "hello",
		ToolCallID: "call_1",
		Name:       "echo",
	})

	if err := store.Save(sess); err != nil {
		t.Fatalf("Save: %v", err)
	}

	loaded, err := store.Load(sess.ID)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if len(loaded.Messages) != 2 {
		t.Fatalf("got %d messages, want 2", len(loaded.Messages))
	}
	if loaded.Messages[0].ToolCalls[0].ID != "call_1" {
		t.Fatalf("tool call ID = %q, want call_1", loaded.Messages[0].ToolCalls[0].ID)
	}
	if loaded.Messages[0].ToolCalls[0].Name != "echo" {
		t.Fatalf("tool call Name = %q, want echo", loaded.Messages[0].ToolCalls[0].Name)
	}
	if loaded.Messages[1].ToolCallID != "call_1" {
		t.Fatalf("tool_call_id = %q, want call_1", loaded.Messages[1].ToolCallID)
	}
}

func TestFileStorePathTraversal(t *testing.T) {
	dir := t.TempDir()
	store, err := session.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	// Try to load with path traversal characters.
	_, err = store.Load("../../../etc/passwd")
	if !errors.Is(err, session.ErrNotFound) {
		t.Fatalf("expected session.ErrNotFound for path traversal, got %v", err)
	}

	_, err = store.Load("../hack")
	if !errors.Is(err, session.ErrNotFound) {
		t.Fatalf("expected session.ErrNotFound for path traversal, got %v", err)
	}
}
