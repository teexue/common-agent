package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/store"
	"github.com/teexue/common-agent/core/tui"
	"gopkg.in/yaml.v3"
)

// ProviderSpec is CLI input for configuring a provider.
type ProviderSpec struct {
	Name         string
	APIStyle     provider.APIStyle
	BaseURL      string
	APIKeyEnv    string
	APIVersion   string
	AuthStyle    provider.AuthStyle
	DefaultModel string
	DisplayName string
	ModelsPath   string
	Vision       bool
	ThinkingType string
	ThinkingKeep string
}

// InitInteractive runs a wizard to bootstrap ~/.common-agent.
func InitInteractive(home string) error {
	if err := ensureHome(home); err != nil {
		return err
	}
	db, err := store.Open(home)
	if err != nil {
		return fmt.Errorf("open state.db: %w", err)
	}
	defer db.Close()
	BindDB(db)

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
max_turns: 0
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
	vendors := provider.BuiltInVendors()
	labels := make([]string, 0, len(vendors)+1)
	for _, v := range vendors {
		labels = append(labels, v.DisplayName)
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
		var vendor provider.Vendor
		for _, v := range vendors {
			if v.DisplayName == choice {
				vendor = v
				break
			}
		}
		spec, apiKeyEnv, err = presetProviderWizard(vendor)
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

func presetProviderWizard(v provider.Vendor) (ProviderSpec, string, error) {
	model, err := selectOrInput(i18n.T("wizard.select.model"), []string{v.DefaultModel}, 0, i18n.T("wizard.input.model_name"))
	if err != nil {
		return ProviderSpec{}, "", err
	}
	if strings.TrimSpace(model) == "" {
		model = v.DefaultModel
	}

	spec := ProviderSpec{
		Name:         v.Name,
		APIStyle:     v.APIStyle,
		BaseURL:      v.BaseURLFor(v.APIStyle),
		APIKeyEnv:    v.APIKeyEnv,
		DefaultModel: model,
		APIVersion:   v.APIVersion,
		AuthStyle:    v.AuthForStyle(v.APIStyle),
		DisplayName: v.DisplayName,
		ModelsPath:   provider.DefaultModelsPathFor(v.APIStyle),
		Vision:       v.Vision,
	}

	if v.SupportsThinking {
		if err := configureThinking(&spec); err != nil {
			return ProviderSpec{}, "", err
		}
	}

	fmt.Print(i18n.T("wizard.summary.selected", "provider", spec.Name, "type", spec.APIStyle, "model", spec.DefaultModel))
	fmt.Println()
	return spec, v.APIKeyEnv, nil
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

	pStyle, err := selectOption(i18n.T("wizard.select.api_type"), []string{"openai", "anthropic"}, 0)
	if err != nil {
		return ProviderSpec{}, "", err
	}
	style := provider.APIStyle(pStyle)

	baseURL, err := inputString(i18n.T("wizard.input.base_url"), defaultBaseURLHint(style))
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
		APIStyle:     style,
		BaseURL:      baseURL,
		APIKeyEnv:    apiKeyEnv,
		DefaultModel: model,
		ModelsPath:   provider.DefaultModelsPathFor(style),
	}

	if style == provider.StyleAnthropic {
		version, err := selectOption(i18n.T("wizard.select.api_version"), []string{"2023-06-01"}, 0)
		if err != nil {
			return ProviderSpec{}, "", err
		}
		spec.APIVersion = version
	}

	if style == provider.StyleOpenAI {
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

func defaultBaseURLHint(style provider.APIStyle) string {
	switch style {
	case provider.StyleAnthropic:
		return "https://api.anthropic.com"
	default:
		return "https://api.example.com/v1"
	}
}

// UpsertProvider adds or updates a provider (SQLite when bound, else providers.yaml).
// For updates, empty APIKeyEnv preserves the existing value.
func UpsertProvider(home string, spec ProviderSpec) error {
	providers := map[string]provider.ProfileEntry{}
	if stateDB != nil {
		var err error
		providers, err = stateDB.ListProviderEntries()
		if err != nil {
			return err
		}
	} else {
		if err := ensureHome(home); err != nil {
			return err
		}
		path := ProvidersFile(home)
		if data, err := os.ReadFile(path); err == nil {
			var file provider.CatalogFile
			if err := yaml.Unmarshal(data, &file); err != nil {
				return fmt.Errorf("parse providers: %w", err)
			}
			providers = file.Providers
			if providers == nil {
				providers = map[string]provider.ProfileEntry{}
			}
		} else if !os.IsNotExist(err) {
			return fmt.Errorf("read providers: %w", err)
		}
	}

	// For updates, preserve existing fields if not provided.
	if existing, ok := providers[spec.Name]; ok {
		if spec.APIKeyEnv == "" {
			spec.APIKeyEnv = existing.APIKeyEnv
		}
		if spec.APIStyle == "" {
			spec.APIStyle = existing.APIStyle
		}
		if spec.DefaultModel == "" {
			spec.DefaultModel = existing.DefaultModel
		}
		if spec.BaseURL == "" {
			spec.BaseURL = existing.BaseURL
		}
		if spec.ModelsPath == "" {
			spec.ModelsPath = existing.ModelsPath
		}
		if spec.APIVersion == "" {
			spec.APIVersion = existing.APIVersion
		}
	}

	if err := spec.validate(); err != nil {
		return err
	}

	entry := provider.ProfileEntry{
		APIStyle:     spec.APIStyle,
		BaseURL:      spec.BaseURL,
		APIKeyEnv:    spec.APIKeyEnv,
		APIVersion:   spec.APIVersion,
		AuthStyle:    spec.AuthStyle,
		DefaultModel: spec.DefaultModel,
		DisplayName:  spec.DisplayName,
		ModelsPath:   spec.ModelsPath,
		Vision:       spec.Vision,
	}
	if spec.ThinkingType != "" {
		entry.Thinking = &provider.ThinkingConfig{Type: spec.ThinkingType, Keep: spec.ThinkingKeep}
	}

	if stateDB != nil {
		return stateDB.UpsertProviderEntry(spec.Name, entry)
	}
	providers[spec.Name] = entry
	data, err := yaml.Marshal(provider.CatalogFile{Providers: providers})
	if err != nil {
		return fmt.Errorf("marshal providers: %w", err)
	}
	return os.WriteFile(ProvidersFile(home), data, 0o644)
}

// DeleteProvider removes a provider (SQLite when bound, else providers.yaml).
func DeleteProvider(home string, name string) error {
	if name == "" {
		return fmt.Errorf("provider name is required")
	}
	if stateDB != nil {
		return stateDB.DeleteProviderEntry(name)
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
	if s.APIStyle != provider.StyleAnthropic && s.APIStyle != provider.StyleOpenAI {
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
