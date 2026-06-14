package provider_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/teexue/common-agent/core/provider"
)

func TestLoadCatalog(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "providers.yaml")
	content := `providers:
  anthropic:
    type: anthropic
    api_key_env: ANTHROPIC_API_KEY
  openai:
    type: openai
    api_key_env: OPENAI_API_KEY
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	catalog, err := provider.LoadCatalog(path, nil)
	if err != nil {
		t.Fatalf("LoadCatalog: %v", err)
	}
	if len(catalog.Names()) != 2 {
		t.Fatalf("expected 2 providers, got %d", len(catalog.Names()))
	}
}

func TestResolveAnthropicProfile(t *testing.T) {
	t.Setenv("ANTHROPIC_API_KEY", "test-key")

	dir := t.TempDir()
	path := filepath.Join(dir, "providers.yaml")
	content := `providers:
  anthropic:
    type: anthropic
    api_key_env: ANTHROPIC_API_KEY
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	catalog, err := provider.LoadCatalog(path, nil)
	if err != nil {
		t.Fatal(err)
	}

	p, err := catalog.ResolveForAgent("anthropic")
	if err != nil {
		t.Fatalf("ResolveForAgent: %v", err)
	}
	if p == nil {
		t.Fatal("expected provider")
	}
}

func TestInvalidAPIKeyEnvValue(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "providers.yaml")
	content := `providers:
  bad:
    type: anthropic
    api_key_env: sk-not-a-var-name
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := provider.LoadCatalog(path, nil); err == nil {
		t.Fatal("expected error when api_key_env looks like a key")
	}
}

func TestResolveMissingAPIKey(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "providers.yaml")
	content := `providers:
  anthropic:
    type: anthropic
    api_key_env: ANTHROPIC_API_KEY
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	os.Unsetenv("ANTHROPIC_API_KEY")

	catalog, err := provider.LoadCatalog(path, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := catalog.ResolveForAgent("anthropic"); err == nil {
		t.Fatal("expected error for missing api key")
	}
}
