package service

import (
	"fmt"

	"github.com/teexue/common-agent/core/session"
)

// ListSessions returns metadata for all stored sessions.
func (s *Service) ListSessions() ([]session.SessionMeta, error) {
	if s.Store == nil {
		return nil, fmt.Errorf("session persistence not configured")
	}
	return s.Store.List()
}

// LoadSession retrieves a session by ID. Returns session.ErrNotFound if not found.
func (s *Service) LoadSession(id string) (*session.Session, error) {
	if s.Store == nil {
		return nil, fmt.Errorf("session persistence not configured")
	}
	if id == "" {
		return nil, fmt.Errorf("session id is required")
	}
	return s.Store.Load(id)
}

// DeleteSession removes a session by ID. Returns session.ErrNotFound if not found.
func (s *Service) DeleteSession(id string) error {
	if s.Store == nil {
		return fmt.Errorf("session persistence not configured")
	}
	if id == "" {
		return fmt.Errorf("session id is required")
	}
	return s.Store.Delete(id)
}
