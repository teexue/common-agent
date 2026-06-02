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
		Type:         provider.KindOpenAI,
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

func TestInstallDefaults(t *testing.T) {
	dir := t.TempDir()
	if err := config.InstallDefaults(dir); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(config.ScenariosDir(dir), "demo.yaml")); err != nil {
		t.Fatal(err)
	}
}
