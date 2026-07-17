package service_test

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/service"
)

func TestSaveAgent_RenameDisplayName(t *testing.T) {
	dir := t.TempDir()
	svc := &service.Service{AgentsDir: dir, Logger: slog.Default()}

	yaml1 := []byte(`id: agt_test01
name: old-name
provider: openai
model: gpt-4o
system_prompt: hi
tools: [echo]
`)
	require.NoError(t, svc.SaveAgent("agt_test01", yaml1))

	yaml2 := []byte(`id: agt_test01
name: new-name
provider: openai
model: gpt-4o
system_prompt: hi
tools: [echo]
`)
	require.NoError(t, svc.SaveAgent("agt_test01", yaml2))

	a, err := svc.GetAgent("agt_test01")
	require.NoError(t, err)
	assert.Equal(t, "new-name", a.Name)
	assert.Equal(t, "agt_test01", a.ID)

	// File stays under id
	_, err = os.Stat(filepath.Join(dir, "agt_test01.yaml"))
	require.NoError(t, err)

	byName, err := svc.GetAgent("new-name")
	require.NoError(t, err)
	assert.Equal(t, "agt_test01", byName.ID)
}

func TestCreateAgent_AssignsID(t *testing.T) {
	dir := t.TempDir()
	svc := &service.Service{AgentsDir: dir, Logger: slog.Default()}

	yaml := []byte(`name: fresh
provider: openai
model: gpt-4o
system_prompt: hi
tools: [echo]
`)
	a, err := svc.CreateAgent(yaml)
	require.NoError(t, err)
	assert.NotEmpty(t, a.ID)
	assert.Equal(t, "fresh", a.Name)
	assert.Equal(t, "agt_", a.ID[:4])
}
