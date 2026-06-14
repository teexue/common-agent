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
	Agent     string
	Messages  []provider.Message
	Metadata  map[string]string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// New creates a session with a random UUID-based ID.
func New(agentName string) *Session {
	now := time.Now().UTC()
	return &Session{
		ID:        newID("sess"),
		Agent:     agentName,
		Messages:  nil,
		Metadata:  make(map[string]string),
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// touch updates the UpdatedAt timestamp. Caller must hold s.mu.
func (s *Session) touch() {
	s.UpdatedAt = time.Now().UTC()
}

// AddMessages appends messages to the session in a concurrency-safe way.
func (s *Session) AddMessages(msgs ...provider.Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = append(s.Messages, msgs...)
	s.touch()
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
	s.touch()
}

// Clear removes all messages.
func (s *Session) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Messages = nil
	s.touch()
}

// GetMetadata returns a copy of the metadata map.
func (s *Session) GetMetadata() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]string, len(s.Metadata))
	for k, v := range s.Metadata {
		out[k] = v
	}
	return out
}

// SetMetadata sets a key-value pair in the metadata map.
func (s *Session) SetMetadata(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Metadata == nil {
		s.Metadata = make(map[string]string)
	}
	s.Metadata[key] = value
	s.touch()
}

func newID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// fallback to timestamp if crypto/rand fails
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return fmt.Sprintf("%s_%x", prefix, b)
}
