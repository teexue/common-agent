package loop

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/session"
)

type cloneStore struct {
	mu sync.Mutex
	m  map[string]*session.Session
}

func newCloneStore() *cloneStore {
	return &cloneStore{m: map[string]*session.Session{}}
}

func cloneSession(s *session.Session) *session.Session {
	out := session.NewForUser(s.Agent, s.UserID)
	out.ID = s.ID
	out.SetMessages(s.GetMessages())
	for k, v := range s.GetMetadata() {
		out.SetMetadata(k, v)
	}
	return out
}

func (s *cloneStore) Save(sess *session.Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[sess.ID] = cloneSession(sess)
	return nil
}

func (s *cloneStore) Load(id string) (*session.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.m[id]
	if !ok {
		return nil, session.ErrNotFound
	}
	return cloneSession(sess), nil
}

func (s *cloneStore) List() ([]session.SessionMeta, error) { return nil, nil }

func (s *cloneStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.m, id)
	return nil
}

func TestPrepareSession_KeepsLoadedModelLock(t *testing.T) {
	store := newCloneStore()
	empty := session.New("agt")
	require.NoError(t, store.Save(empty))

	live := cloneSession(empty)
	live.SetMetadata(session.MetadataKeyModel, "picked")
	live.SetMetadata(session.MetadataKeyProvider, "openai")

	cfg, err := prepareSession(Config{
		Store:     store,
		SessionID: empty.ID,
		Session:   live,
		Prompt:    "hi",
	})
	require.NoError(t, err)
	assert.Equal(t, "picked", cfg.Session.GetMetadata()[session.MetadataKeyModel])
	assert.Equal(t, "openai", cfg.Session.GetMetadata()[session.MetadataKeyProvider])

	saved, err := store.Load(empty.ID)
	require.NoError(t, err)
	assert.Equal(t, "picked", saved.GetMetadata()[session.MetadataKeyModel])
}

func TestPrepareSession_ReloadsPlaceholderSession(t *testing.T) {
	store := newCloneStore()
	stored := session.New("agt")
	stored.SetMetadata(session.MetadataKeyModel, "locked")
	require.NoError(t, store.Save(stored))

	placeholder := session.New("agt")
	cfg, err := prepareSession(Config{
		Store:     store,
		SessionID: stored.ID,
		Session:   placeholder,
		Prompt:    "hi",
	})
	require.NoError(t, err)
	assert.Equal(t, stored.ID, cfg.Session.ID)
	assert.Equal(t, "locked", cfg.Session.GetMetadata()[session.MetadataKeyModel])
}
