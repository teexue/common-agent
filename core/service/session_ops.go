package service

import (
	"fmt"

	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/store"
)

// ListSessions returns metadata for sessions owned by userID.
func (s *Service) ListSessions(userID string) ([]session.SessionMeta, error) {
	if s.Store == nil {
		return nil, fmt.Errorf("session persistence not configured")
	}
	if gs, ok := s.Store.(*store.SessionStore); ok {
		return gs.ListByUser(userID)
	}
	metas, err := s.Store.List()
	if err != nil {
		return nil, err
	}
	if userID == "" {
		return metas, nil
	}
	out := make([]session.SessionMeta, 0, len(metas))
	for _, m := range metas {
		uid := m.UserID
		if uid == "" {
			uid = store.DefaultUserID
		}
		if uid == userID {
			out = append(out, m)
		}
	}
	return out, nil
}

// LoadSession retrieves a session by ID for the given user.
func (s *Service) LoadSession(id, userID string) (*session.Session, error) {
	if s.Store == nil {
		return nil, fmt.Errorf("session persistence not configured")
	}
	if id == "" {
		return nil, fmt.Errorf("session id is required")
	}
	if gs, ok := s.Store.(*store.SessionStore); ok {
		return gs.LoadForUser(id, userID)
	}
	sess, err := s.Store.Load(id)
	if err != nil {
		return nil, err
	}
	uid := sess.UserID
	if uid == "" {
		uid = store.DefaultUserID
	}
	if userID != "" && uid != userID {
		return nil, session.ErrNotFound
	}
	return sess, nil
}

// DeleteSession removes a session by ID for the given user.
func (s *Service) DeleteSession(id, userID string) error {
	if s.Store == nil {
		return fmt.Errorf("session persistence not configured")
	}
	if id == "" {
		return fmt.Errorf("session id is required")
	}
	if gs, ok := s.Store.(*store.SessionStore); ok {
		return gs.DeleteForUser(id, userID)
	}
	if _, err := s.LoadSession(id, userID); err != nil {
		return err
	}
	return s.Store.Delete(id)
}
