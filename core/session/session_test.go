package session_test

import (
	"sync"
	"testing"

	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
)

func TestNewSession(t *testing.T) {
	s := session.New("demo")
	if s.ID == "" {
		t.Fatal("expected non-empty session ID")
	}
	if s.Scenario != "demo" {
		t.Fatalf("scenario = %q, want demo", s.Scenario)
	}
	if s.GetMessages() == nil {
		t.Fatal("expected non-nil messages slice")
	}
	if len(s.GetMessages()) != 0 {
		t.Fatal("expected empty messages")
	}
}

func TestSessionIDIsUnique(t *testing.T) {
	ids := map[string]bool{}
	for i := 0; i < 100; i++ {
		s := session.New("demo")
		if ids[s.ID] {
			t.Fatalf("duplicate session ID: %s", s.ID)
		}
		ids[s.ID] = true
	}
}

func TestAddAndGetMessages(t *testing.T) {
	s := session.New("demo")
	msg := provider.Message{Role: provider.RoleUser, Content: "hello"}
	s.AddMessages(msg)
	msgs := s.GetMessages()
	if len(msgs) != 1 {
		t.Fatalf("got %d messages, want 1", len(msgs))
	}
	if msgs[0].Content != "hello" {
		t.Fatalf("content = %q, want hello", msgs[0].Content)
	}
	// Verify it's a copy.
	msgs[0].Content = "modified"
	if s.GetMessages()[0].Content != "hello" {
		t.Fatal("GetMessages should return a copy")
	}
}

func TestClear(t *testing.T) {
	s := session.New("demo")
	s.AddMessages(provider.Message{Role: provider.RoleUser, Content: "hello"})
	s.Clear()
	if len(s.GetMessages()) != 0 {
		t.Fatal("expected empty messages after clear")
	}
}

func TestSetMessages(t *testing.T) {
	s := session.New("demo")
	s.AddMessages(provider.Message{Role: provider.RoleUser, Content: "old"})
	s.SetMessages([]provider.Message{
		{Role: provider.RoleSystem, Content: "new"},
	})
	msgs := s.GetMessages()
	if len(msgs) != 1 || msgs[0].Content != "new" {
		t.Fatal("SetMessages did not replace messages")
	}
}

func TestConcurrentAccess(t *testing.T) {
	s := session.New("demo")
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			s.AddMessages(provider.Message{Role: provider.RoleUser, Content: "msg"})
		}()
		go func() {
			defer wg.Done()
			_ = s.GetMessages()
		}()
	}
	wg.Wait()
	if len(s.GetMessages()) != 50 {
		t.Fatalf("got %d messages, want 50", len(s.GetMessages()))
	}
}
