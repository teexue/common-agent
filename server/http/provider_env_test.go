package httpapi

import "testing"

func TestResolveProviderAPIKeyEnv_KeepsExistingOnResave(t *testing.T) {
	got := resolveProviderAPIKeyEnv(
		"ollama_glm53_flash",
		"",
		"OLLAMA_API_KEY",
		"",
		false,
	)
	if got != "OLLAMA_API_KEY" {
		t.Fatalf("re-save without key must keep existing env, got %q", got)
	}
}

func TestResolveProviderAPIKeyEnv_RequestedWins(t *testing.T) {
	got := resolveProviderAPIKeyEnv("custom", "MY_KEY", "OLD_KEY", "VENDOR_KEY", true)
	if got != "MY_KEY" {
		t.Fatalf("explicit env must win, got %q", got)
	}
}

func TestResolveProviderAPIKeyEnv_NewProviderDerivesName(t *testing.T) {
	got := resolveProviderAPIKeyEnv("ollama_glm53_flash", "", "", "", false)
	if got != "OLLAMA_GLM53_FLASH_API_KEY" {
		t.Fatalf("new provider derives env, got %q", got)
	}
}
