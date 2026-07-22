package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/tui"
	"gopkg.in/yaml.v3"
)

// ProviderSpec is CLI input for configuring a provider.
type ProviderSpec struct {
	Name         string
	Type         provider.Kind
	BaseURL      string
	APIKeyEnv    string
	APIVersion   string
	DefaultModel string
	Vision       bool
	ThinkingType string
	ThinkingKeep string
}

type providerPreset struct {
	LabelKey     string
	Name         string
	Type         provider.Kind
	BaseURL      string
	APIKeyEnv    string
	Models       []string
	APIVersion   string
	NeedThinking bool
}

func (p providerPreset) label() string {
	return i18n.T(p.LabelKey)
}

var providerPresets = []providerPreset{
	{
		LabelKey:     "wizard.provider.moonshot",
		Name:         "moonshot",
		Type:         provider.KindOpenAI,
		BaseURL:      "https://api.moonshot.cn/v1",
		APIKeyEnv:    "MOONSHOT_API_KEY",
		Models:       []string{"kimi-k2.6", "kimi-k2.5"},
		NeedThinking: true,
	},
	{
		LabelKey:  "wizard.provider.openai",
		Name:      "openai",
		Type:      provider.KindOpenAI,
		BaseURL:   "https://api.openai.com/v1",
		APIKeyEnv: "OPENAI_API_KEY",
		Models:    []string{"gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"},
	},
	{
		LabelKey:   "wizard.provider.anthropic",
		Name:       "anthropic",
		Type:       provider.KindAnthropic,
		BaseURL:    "https://api.anthropic.com",
		APIKeyEnv:  "ANTHROPIC_API_KEY",
		Models:     []string{"claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022"},
		APIVersion: "2023-06-01",
	},
}

// InitInteractive runs a wizard to bootstrap ~/.common-agent.
func InitInteractive(home string) error {
	if err := ensureHome(home); err != nil {
		return err
	}

	tui.PrintWelcome("setup", "config", "wizard")
	fmt.Println(tui.Muted(i18n.T("wizard.config_dir", "path", home)))

	spec, agentName, apiKeyEnv, err := RunProviderWizard()
	if err != nil {
		return err
	}

	apiKey, err := InputSecret(i18n.T("wizard.input.api_key"))
	if err != nil {
		return err
	}
	if strings.TrimSpace(apiKey) == "" {
		return fmt.Errorf("%s", i18n.T("wizard.error.api_key_required"))
	}

	if err := UpsertProvider(home, spec); err != nil {
		return err
	}
	creds, err := NewCredentialStore(home)
	if err != nil {
		return err
	}
	if err := creds.Set(apiKeyEnv, apiKey); err != nil {
		return err
	}

	scPath := fmt.Sprintf("%s/%s.yaml", AgentsDir(home), agentName)
	scContent := fmt.Sprintf(`name: %s
version: 1
provider: %s
model: %s
system_prompt: |
  You are a helpful assistant. Use tools when appropriate.
tools:
  - echo
  - get_time
max_turns: 10
max_tokens: 4096
tool_execution:
  mode: parallel
  max_parallel: 4
`, agentName, spec.Name, spec.DefaultModel)
	if err := os.WriteFile(scPath, []byte(scContent), 0o644); err != nil {
		return fmt.Errorf("write agent: %w", err)
	}

	if err := SaveSettings(home, Settings{DefaultAgent: agentName}); err != nil {
		return err
	}

	fmt.Println(i18n.T("wizard.done"))
	fmt.Println(tui.Success(i18n.T("wizard.config_written", "path", home)))
	fmt.Println(tui.Muted(i18n.T("wizard.run_chat_hint")))
	return nil
}

// RunProviderWizard runs the interactive provider configuration wizard.
// Returns the provider spec, agent name, API key env name, and any error.
func RunProviderWizard() (ProviderSpec, string, string, error) {
	labels := make([]string, 0, len(providerPresets)+1)
	for _, p := range providerPresets {
		labels = append(labels, p.label())
	}
	customLabel := i18n.T("wizard.option.custom")
	labels = append(labels, customLabel)

	choice, err := selectOption(i18n.T("wizard.select.provider"), labels, 0)
	if err != nil {
		return ProviderSpec{}, "", "", err
	}

	var spec ProviderSpec
	var apiKeyEnv string

	if choice == customLabel {
		spec, apiKeyEnv, err = customProviderWizard()
	} else {
		var preset providerPreset
		for _, p := range providerPresets {
			if p.label() == choice {
				preset = p
				break
			}
		}
		spec, apiKeyEnv, err = presetProviderWizard(preset)
	}
	if err != nil {
		return ProviderSpec{}, "", "", err
	}

	agentName, err := selectOrInput(i18n.T("wizard.select.default_agent"), []string{"demo"}, 0, i18n.T("wizard.input.agent_name"))
	if err != nil {
		return ProviderSpec{}, "", "", err
	}

	return spec, agentName, apiKeyEnv, nil
}

func presetProviderWizard(p providerPreset) (ProviderSpec, string, error) {
	model, err := selectOrInput(i18n.T("wizard.select.model"), p.Models, 0, i18n.T("wizard.input.model_name"))
	if err != nil {
		return ProviderSpec{}, "", err
	}

	spec := ProviderSpec{
		Name:         p.Name,
		Type:         p.Type,
		BaseURL:      p.BaseURL,
		APIKeyEnv:    p.APIKeyEnv,
		DefaultModel: model,
		APIVersion:   p.APIVersion,
	}

	if p.NeedThinking {
		if err := configureThinking(&spec); err != nil {
			return ProviderSpec{}, "", err
		}
	}

	fmt.Print(i18n.T("wizard.summary.selected", "provider", spec.Name, "type", spec.Type, "model", spec.DefaultModel))
	fmt.Println()
	return spec, p.APIKeyEnv, nil
}

func configureThinking(spec *ProviderSpec) error {
	thinking, err := selectOption(i18n.T("wizard.select.thinking_mode"), []string{"disabled", "enabled"}, 0)
	if err != nil {
		return err
	}
	spec.ThinkingType = thinking
	if thinking != "enabled" {
		return nil
	}
	noKeep := i18n.T("wizard.option.no_keep")
	keep, err := selectOption(i18n.T("wizard.select.keep_reasoning"), []string{noKeep, "all"}, 0)
	if err != nil {
		return err
	}
	if keep == "all" {
		spec.ThinkingKeep = "all"
	}
	return nil
}

func customProviderWizard() (ProviderSpec, string, error) {
	name, err := inputString(i18n.T("wizard.input.provider_name"), "my-provider")
	if err != nil {
		return ProviderSpec{}, "", err
	}

	pType, err := selectOption(i18n.T("wizard.select.api_type"), []string{"openai", "anthropic"}, 0)
	if err != nil {
		return ProviderSpec{}, "", err
	}

	baseURL, err := inputString(i18n.T("wizard.input.base_url"), "https://api.example.com/v1")
	if err != nil {
		return ProviderSpec{}, "", err
	}

	apiKeyEnv, err := inputString(i18n.T("wizard.input.api_key_env"), strings.ToUpper(name)+"_API_KEY")
	if err != nil {
		return ProviderSpec{}, "", err
	}

	model, err := inputString(i18n.T("wizard.input.default_model"), "")
	if err != nil {
		return ProviderSpec{}, "", err
	}

	spec := ProviderSpec{
		Name:         name,
		Type:         provider.Kind(pType),
		BaseURL:      baseURL,
		APIKeyEnv:    apiKeyEnv,
		DefaultModel: model,
	}

	if spec.Type == provider.KindAnthropic {
		version, err := selectOption(i18n.T("wizard.select.api_version"), []string{"2023-06-01"}, 0)
		if err != nil {
			return ProviderSpec{}, "", err
		}
		spec.APIVersion = version
	}

	if spec.Type == provider.KindOpenAI {
		notSet := i18n.T("wizard.option.not_set")
		thinking, err := selectOption(i18n.T("wizard.select.thinking_mode_custom"), []string{"disabled", "enabled", notSet}, 2)
		if err != nil {
			return ProviderSpec{}, "", err
		}
		if thinking != notSet {
			spec.ThinkingType = thinking
		}
	}

	return spec, apiKeyEnv, nil
}

// UpsertProvider adds or updates a provider in providers.yaml.
// For updates, empty APIKeyEnv preserves the existing value.
func UpsertProvider(home string, spec ProviderSpec) error {
	if err := ensureHome(home); err != nil {
		return err
	}

	path := ProvidersFile(home)
	providers := map[string]provider.ProfileEntry{}
	if data, err := os.ReadFile(path); err == nil {
		var file provider.CatalogFile
		if err := yaml.Unmarshal(data, &file); err != nil {
			return fmt.Errorf("parse providers: %w", err)
		}
		providers = file.Providers
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("read providers: %w", err)
	}

	// For updates, preserve existing api_key_env if not provided.
	if existing, ok := providers[spec.Name]; ok {
		if spec.APIKeyEnv == "" {
			spec.APIKeyEnv = existing.APIKeyEnv
		}
		if spec.Type == "" {
			spec.Type = existing.Type
		}
		if spec.DefaultModel == "" {
			spec.DefaultModel = existing.DefaultModel
		}
	}

	if err := spec.validate(); err != nil {
		return err
	}

	entry := provider.ProfileEntry{
		Type:         spec.Type,
		BaseURL:      spec.BaseURL,
		APIKeyEnv:    spec.APIKeyEnv,
		APIVersion:   spec.APIVersion,
		DefaultModel: spec.DefaultModel,
		Vision:       spec.Vision,
	}
	if spec.ThinkingType != "" {
		entry.Thinking = &provider.ThinkingConfig{Type: spec.ThinkingType, Keep: spec.ThinkingKeep}
	}
	providers[spec.Name] = entry

	data, err := yaml.Marshal(provider.CatalogFile{Providers: providers})
	if err != nil {
		return fmt.Errorf("marshal providers: %w", err)
	}
	return os.WriteFile(path, data, 0o644)
}

// DeleteProvider removes a provider from providers.yaml.
func DeleteProvider(home string, name string) error {
	if name == "" {
		return fmt.Errorf("provider name is required")
	}
	path := ProvidersFile(home)
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read providers: %w", err)
	}
	var file provider.CatalogFile
	if err := yaml.Unmarshal(data, &file); err != nil {
		return fmt.Errorf("parse providers: %w", err)
	}
	if file.Providers == nil {
		return fmt.Errorf("provider %q not found", name)
	}
	if _, ok := file.Providers[name]; !ok {
		return fmt.Errorf("provider %q not found", name)
	}
	delete(file.Providers, name)
	out, err := yaml.Marshal(file)
	if err != nil {
		return fmt.Errorf("marshal providers: %w", err)
	}
	return os.WriteFile(path, out, 0o644)
}

func (s ProviderSpec) validate() error {
	if s.Name == "" {
		return fmt.Errorf("%s", i18n.T("wizard.error.provider_name_required"))
	}
	if s.Type != provider.KindAnthropic && s.Type != provider.KindOpenAI {
		return fmt.Errorf("%s", i18n.T("wizard.error.type_invalid"))
	}
	if s.APIKeyEnv == "" {
		return fmt.Errorf("%s", i18n.T("wizard.error.api_key_env_required"))
	}
	if s.DefaultModel == "" {
		return fmt.Errorf("%s", i18n.T("wizard.error.model_required"))
	}
	return nil
}
