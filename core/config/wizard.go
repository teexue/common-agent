package config

import (
	"fmt"
	"os"
	"strings"

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
	ThinkingType string
	ThinkingKeep string
}

type providerPreset struct {
	Label       string
	Name        string
	Type        provider.Kind
	BaseURL     string
	APIKeyEnv   string
	Models      []string
	APIVersion  string
	NeedThinking bool
}

var providerPresets = []providerPreset{
	{
		Label:        "Moonshot (Kimi)",
		Name:         "moonshot",
		Type:         provider.KindOpenAI,
		BaseURL:      "https://api.moonshot.cn/v1",
		APIKeyEnv:    "MOONSHOT_API_KEY",
		Models:       []string{"kimi-k2.6", "kimi-k2.5"},
		NeedThinking: true,
	},
	{
		Label:        "OpenAI",
		Name:         "openai",
		Type:         provider.KindOpenAI,
		BaseURL:      "https://api.openai.com/v1",
		APIKeyEnv:    "OPENAI_API_KEY",
		Models:       []string{"gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"},
	},
	{
		Label:       "Anthropic",
		Name:        "anthropic",
		Type:        provider.KindAnthropic,
		BaseURL:     "https://api.anthropic.com",
		APIKeyEnv:   "ANTHROPIC_API_KEY",
		Models:      []string{"claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022"},
		APIVersion:  "2023-06-01",
	},
}

// InitInteractive runs a wizard to bootstrap ~/.common-agent.
func InitInteractive(home string) error {
	if err := ensureHome(home); err != nil {
		return err
	}

	tui.PrintWelcome("setup", "config", "wizard")
	fmt.Println(tui.Muted("配置目录: " + home))

	spec, agentName, apiKeyEnv, err := RunProviderWizard()
	if err != nil {
		return err
	}

	apiKey, err := InputSecret("API Key")
	if err != nil {
		return err
	}
	if strings.TrimSpace(apiKey) == "" {
		return fmt.Errorf("API Key 不能为空")
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

	fmt.Println("\n配置完成")
	fmt.Println(tui.Success("配置已写入 " + home))
	fmt.Println(tui.Muted("运行: agent-server chat"))
	return nil
}

// RunProviderWizard runs the interactive provider configuration wizard.
// Returns the provider spec, agent name, API key env name, and any error.
func RunProviderWizard() (ProviderSpec, string, string, error) {
	labels := make([]string, 0, len(providerPresets)+1)
	for _, p := range providerPresets {
		labels = append(labels, p.Label)
	}
	labels = append(labels, "自定义...")

	choice, err := selectOption("选择服务商", labels, 0)
	if err != nil {
		return ProviderSpec{}, "", "", err
	}

	var spec ProviderSpec
	var apiKeyEnv string

	if choice == "自定义..." {
		spec, apiKeyEnv, err = customProviderWizard()
	} else {
		var preset providerPreset
		for _, p := range providerPresets {
			if p.Label == choice {
				preset = p
				break
			}
		}
		spec, apiKeyEnv, err = presetProviderWizard(preset)
	}
	if err != nil {
		return ProviderSpec{}, "", "", err
	}

	agentName, err := selectOrInput("默认 Agent", []string{"demo"}, 0, "Agent 名称")
	if err != nil {
		return ProviderSpec{}, "", "", err
	}

	return spec, agentName, apiKeyEnv, nil
}

func presetProviderWizard(p providerPreset) (ProviderSpec, string, error) {
	model, err := selectOrInput("选择模型", p.Models, 0, "模型名称")
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

	fmt.Printf("\n已选: provider=%s type=%s model=%s\n", spec.Name, spec.Type, spec.DefaultModel)
	return spec, p.APIKeyEnv, nil
}

func configureThinking(spec *ProviderSpec) error {
	thinking, err := selectOption("Thinking 模式（Agent 建议 disabled）", []string{"disabled", "enabled"}, 0)
	if err != nil {
		return err
	}
	spec.ThinkingType = thinking
	if thinking != "enabled" {
		return nil
	}
	keep, err := selectOption("保留历史 reasoning", []string{"不保留", "all"}, 0)
	if err != nil {
		return err
	}
	if keep == "all" {
		spec.ThinkingKeep = "all"
	}
	return nil
}

func customProviderWizard() (ProviderSpec, string, error) {
	name, err := inputString("Provider 名称", "my-provider")
	if err != nil {
		return ProviderSpec{}, "", err
	}

	pType, err := selectOption("API 类型", []string{"openai", "anthropic"}, 0)
	if err != nil {
		return ProviderSpec{}, "", err
	}

	baseURL, err := inputString("Base URL", "https://api.example.com/v1")
	if err != nil {
		return ProviderSpec{}, "", err
	}

	apiKeyEnv, err := inputString("API Key 变量名", strings.ToUpper(name)+"_API_KEY")
	if err != nil {
		return ProviderSpec{}, "", err
	}

	model, err := inputString("默认模型", "")
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
		version, err := selectOption("Anthropic API Version", []string{"2023-06-01"}, 0)
		if err != nil {
			return ProviderSpec{}, "", err
		}
		spec.APIVersion = version
	}

	if spec.Type == provider.KindOpenAI {
		thinking, err := selectOption("Thinking 模式", []string{"disabled", "enabled", "不设置"}, 2)
		if err != nil {
			return ProviderSpec{}, "", err
		}
		if thinking != "不设置" {
			spec.ThinkingType = thinking
		}
	}

	return spec, apiKeyEnv, nil
}

// UpsertProvider adds or updates a provider in providers.yaml.
func UpsertProvider(home string, spec ProviderSpec) error {
	if err := spec.validate(); err != nil {
		return err
	}
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

	entry := provider.ProfileEntry{
		Type:         spec.Type,
		BaseURL:      spec.BaseURL,
		APIKeyEnv:    spec.APIKeyEnv,
		APIVersion:   spec.APIVersion,
		DefaultModel: spec.DefaultModel,
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

func (s ProviderSpec) validate() error {
	if s.Name == "" {
		return fmt.Errorf("provider name is required")
	}
	if s.Type != provider.KindAnthropic && s.Type != provider.KindOpenAI {
		return fmt.Errorf("type must be anthropic or openai")
	}
	if s.APIKeyEnv == "" {
		return fmt.Errorf("api_key_env is required")
	}
	if s.DefaultModel == "" {
		return fmt.Errorf("model is required")
	}
	return nil
}

// InstallDefaults copies built-in templates when home is empty.
func InstallDefaults(home string) error {
	if err := ensureHome(home); err != nil {
		return err
	}
	providersPath := ProvidersFile(home)
	if _, err := os.Stat(providersPath); os.IsNotExist(err) {
		content := `providers:
  moonshot:
    type: openai
    base_url: https://api.moonshot.cn/v1
    api_key_env: MOONSHOT_API_KEY
    default_model: kimi-k2.6
    thinking:
      type: disabled
`
		if err := os.WriteFile(providersPath, []byte(content), 0o644); err != nil {
			return err
		}
	}
	// Install built-in agent templates (skips existing ones).
	InstallAllTemplates(home)
	_, err := LoadSettings(home)
	if err != nil {
		return err
	}
	settingsPath := SettingsFile(home)
	if _, err := os.Stat(settingsPath); os.IsNotExist(err) {
		return SaveSettings(home, Settings{DefaultAgent: "chat-assistant"})
	}
	return nil
}
