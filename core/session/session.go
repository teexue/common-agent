package session

import (
	"crypto/rand"
	"fmt"
	"sync"
	"time"

	"github.com/teexue/common-agent/core/provider"
)

// Session holds in-memory conversation state for one agent run.
// It is safe for concurrent use by a single producer (the loop) and
// multiple readers.
type Session struct {
	mu        sync.RWMutex
	ID        string
	Scenario  string
	Messages  []provider.Message
	CreatedAt time.Time
}

// New creates a session with a random UUID-based ID.
func New(scenarioName string) *Session {
	return &Session{
		ID:        newID("sess"),
		Scenario:  scenarioName,
		Messages:  nil,
		CreatedAt: time.Now().UTC(),
	}
}

// AddMessages appends messages to the session in a concurrency-safe way.
func (s *Session) AddMessages(msgs ...provider.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = append(s.Messages, msgs...)
}

// GetMessages returns a copy of the current messages slice.
func (s *Session) GetMessages() []provider.Message {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]provider.Message, len(s.Messages))
	copy(out, s.Messages)
	return out
}

// SetMessages replaces all messages (for /clear).
func (s *Session) SetMessages(msgs []provider.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = msgs
}

// Clear removes all messages.
func (s *Session) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = nil
}

func newID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// fallback to timestamp if crypto/rand fails
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return fmt.Sprintf("%s_%x", prefix, b)
}
