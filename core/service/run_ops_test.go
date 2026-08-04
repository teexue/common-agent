package service_test

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/registry"
)

// memStore is a minimal in-memory session.Store for workdir tests.
type memStore struct {
	sessions map[string]*session.Session
}

func newMemStore() *memStore { return &memStore{sessions: map[string]*session.Session{}} }

func (m *memStore) Save(sess *session.Session) error {
	m.sessions[sess.ID] = sess
	return nil
}

func (m *memStore) Load(id string) (*session.Session, error) {
	sess, ok := m.sessions[id]
	if !ok {
		return nil, session.ErrNotFound
	}
	return sess, nil
}

func (m *memStore) List() ([]session.SessionMeta, error) { return nil, nil }

func (m *memStore) Delete(id string) error {
	delete(m.sessions, id)
	return nil
}

func writePlainAgent(t *testing.T, dir string) {
	t.Helper()
	yaml := `id: agt_wd
name: wd-demo
provider: mock
model: mock-1
system_prompt: you are a helper
tools: [echo]
`
	require.NoError(t, os.WriteFile(filepath.Join(dir, "agt_wd.yaml"), []byte(yaml), 0o644))
}

func newWorkdirService(t *testing.T, agentsDir string, store session.Store) *service.Service {
	t.Helper()
	return service.New(service.ServiceConfig{
		AgentsDir:   agentsDir,
		Registry:    registry.New(),
		NewProvider: func(*agent.Agent) (provider.Provider, error) { return &provider.MockProvider{}, nil },
		Store:       store,
		Logger:      slog.Default(),
	})
}

func TestPrepareRun_WorkdirExplicitPersistsToSession(t *testing.T) {
	agentsDir := t.TempDir()
	writePlainAgent(t, agentsDir)
	svc := newWorkdirService(t, agentsDir, newMemStore())

	result, err := svc.PrepareRun(context.Background(), service.RunRequest{
		Agent:   "agt_wd",
		Prompt:  "hi",
		WorkDir: "/tmp/explicit",
	}, nil)
	require.NoError(t, err)

	assert.Equal(t, "/tmp/explicit", result.Config.WorkDir)
	assert.Equal(t, "/tmp/explicit", result.Session.GetMetadata()[session.MetadataKeyWorkdir])
}

func TestPrepareRun_WorkdirFallsBackToSession(t *testing.T) {
	agentsDir := t.TempDir()
	writePlainAgent(t, agentsDir)
	store := newMemStore()
	svc := newWorkdirService(t, agentsDir, store)

	sess := session.NewForUser("agt_wd", "usr_local")
	sess.SetMetadata(session.MetadataKeyWorkdir, "/tmp/stored")
	require.NoError(t, store.Save(sess))

	result, err := svc.PrepareRun(context.Background(), service.RunRequest{
		Agent:     "agt_wd",
		Prompt:    "hi",
		SessionID: sess.ID,
	}, nil)
	require.NoError(t, err)

	assert.Equal(t, "/tmp/stored", result.Config.WorkDir)
}

func TestPrepareRun_WorkdirEmptyByDefault(t *testing.T) {
	agentsDir := t.TempDir()
	writePlainAgent(t, agentsDir)
	svc := newWorkdirService(t, agentsDir, newMemStore())

	result, err := svc.PrepareRun(context.Background(), service.RunRequest{
		Agent:  "agt_wd",
		Prompt: "hi",
	}, nil)
	require.NoError(t, err)

	assert.Empty(t, result.Config.WorkDir)
	assert.Empty(t, result.Session.GetMetadata()[session.MetadataKeyWorkdir])
}

func TestPrepareRun_ExplicitWorkdirOverridesStored(t *testing.T) {
	agentsDir := t.TempDir()
	writePlainAgent(t, agentsDir)
	store := newMemStore()
	svc := newWorkdirService(t, agentsDir, store)

	sess := session.NewForUser("agt_wd", "usr_local")
	sess.SetMetadata(session.MetadataKeyWorkdir, "/tmp/stored")
	require.NoError(t, store.Save(sess))

	result, err := svc.PrepareRun(context.Background(), service.RunRequest{
		Agent:     "agt_wd",
		Prompt:    "hi",
		SessionID: sess.ID,
		WorkDir:   "/tmp/new",
	}, nil)
	require.NoError(t, err)

	assert.Equal(t, "/tmp/new", result.Config.WorkDir)
	assert.Equal(t, "/tmp/new", result.Session.GetMetadata()[session.MetadataKeyWorkdir])
}
