package session

import (
	"errors"
	"time"
)

// ErrNotFound is returned by Store.Load and Store.Delete when the session does not exist.
var ErrNotFound = errors.New("session not found")

// SessionMeta is the lightweight metadata returned by Store.List.
// It omits the full message payload for efficiency.
type SessionMeta struct {
	ID        string            `json:"id"`
	Agent     string            `json:"agent"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// Store is the persistence interface for sessions.
// Implementations must be safe for concurrent use.
type Store interface {
	// Save persists a session. If a session with the same ID already exists,
	// it is overwritten (upsert semantics).
	Save(sess *Session) error

	// Load retrieves a session by ID. Returns ErrNotFound if not found.
	Load(id string) (*Session, error)

	// List returns metadata for all stored sessions, ordered by UpdatedAt descending.
	List() ([]SessionMeta, error)

	// Delete removes a session by ID. Returns ErrNotFound if not found.
	Delete(id string) error
}
