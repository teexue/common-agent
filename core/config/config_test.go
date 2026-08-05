package config_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/provider"
)

func TestCredentialsRoundTrip(t *testing.T) {
	dir := t.TempDir()
	if err := config.SetCredential(dir, "MOONSHOT_API_KEY", "sk-test"); err != nil {
		t.Fatal(err)
	}
	if err := config.LoadCredentials(dir); err != nil {
		t.Fatal(err)
	}
	if got := config.GetCredential("MOONSHOT_API_KEY"); got != "sk-test" {
		t.Fatalf("got %q", got)
	}
	info, err := os.Stat(config.CredentialsFile(dir))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("credentials mode = %o, want 600", info.Mode().Perm())
	}
}

func TestUpsertProvider(t *testing.T) {
	dir := t.TempDir()
	spec := config.ProviderSpec{
		Name:         "moonshot",
		APIStyle:     provider.StyleOpenAI,
		BaseURL:      "https://api.moonshot.cn/v1",
		APIKeyEnv:    "MOONSHOT_API_KEY",
		DefaultModel: "kimi-k2.6",
		ThinkingType: "disabled",
	}
	if err := config.UpsertProvider(dir, spec); err != nil {
		t.Fatal(err)
	}
	catalog, err := provider.LoadCatalog(config.ProvidersFile(dir), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Names()) != 1 {
		t.Fatalf("providers = %v", catalog.Names())
	}
}

func TestEnsureDirs(t *testing.T) {
	dir := t.TempDir()
	if err := config.EnsureDirs(dir); err != nil {
		t.Fatal(err)
	}
	for _, sub := range []string{"agents", "sessions", "knowledge"} {
		if _, err := os.Stat(filepath.Join(dir, sub)); err != nil {
			t.Fatalf("expected %s dir: %v", sub, err)
		}
	}
	// EnsureDirs must NOT pre-install any vendor provider or agent.
	if _, err := os.Stat(config.ProvidersFile(dir)); !os.IsNotExist(err) {
		t.Fatalf("providers.yaml should not be pre-installed, got err=%v", err)
	}
	if entries, err := os.ReadDir(config.AgentsDir(dir)); err == nil && len(entries) != 0 {
		t.Fatalf("agents dir should be empty, got %d entries", len(entries))
	}
}
