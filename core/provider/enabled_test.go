package provider_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/provider"
)

func TestEnabledModels(t *testing.T) {
	t.Parallel()
	selected := provider.EnabledModels(provider.ProfileEntry{
		DefaultModel: "fallback",
		Models:       []string{"a", "b"},
	})
	assert.Equal(t, []string{"a", "b"}, selected)

	legacy := provider.EnabledModels(provider.ProfileEntry{DefaultModel: "only"})
	assert.Equal(t, []string{"only"}, legacy)
}

func TestCatalogModelAllowList(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "test-key")
	dir := t.TempDir()
	path := filepath.Join(dir, "providers.yaml")
	content := `providers:
  openai:
    api_style: openai
    api_key_env: OPENAI_API_KEY
    default_model: gpt-4o
    models:
      - gpt-4o
      - gpt-4o-mini
`
	require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
	catalog, err := provider.LoadCatalog(path, nil)
	require.NoError(t, err)

	assert.True(t, catalog.ModelAllowed("openai", "gpt-4o-mini"))
	assert.False(t, catalog.ModelAllowed("openai", "hidden"))
	name, ok := catalog.ProviderForModel("gpt-4o-mini")
	assert.True(t, ok)
	assert.Equal(t, "openai", name)

	infos, err := catalog.EnabledModelInfos("openai")
	require.NoError(t, err)
	require.Len(t, infos, 2)
	assert.Equal(t, "gpt-4o", infos[0].ID)
}

func TestProviderForModel_StableWhenShared(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "test-key")
	dir := t.TempDir()
	path := filepath.Join(dir, "providers.yaml")
	content := `providers:
  openai:
    api_style: openai
    api_key_env: OPENAI_API_KEY
    default_model: gpt-4o
    models: [gpt-4o]
  azure:
    api_style: openai
    api_key_env: OPENAI_API_KEY
    default_model: gpt-4o
    models: [gpt-4o]
`
	require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
	catalog, err := provider.LoadCatalog(path, nil)
	require.NoError(t, err)

	for range 20 {
		name, ok := catalog.ProviderForModel("gpt-4o")
		require.True(t, ok)
		assert.Equal(t, "azure", name)
	}
}
