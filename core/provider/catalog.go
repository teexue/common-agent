package provider

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Kind identifies a provider implementation.
type Kind string

const (
	KindAnthropic Kind = "anthropic"
	KindOpenAI    Kind = "openai"
)

// Profile is a resolved provider configuration.
type Profile struct {
	Name       string
	Kind       Kind
	BaseURL    string
	APIKey     string
	APIVersion string
	Vision     bool
	Thinking   *ThinkingConfig
}

// ProfileEntry is a provider definition in providers.yaml.
type ProfileEntry struct {
	Type         Kind            `yaml:"type"`
	BaseURL      string          `yaml:"base_url"`
	APIKeyEnv    string          `yaml:"api_key_env"`
	APIVersion   string          `yaml:"api_version"`
	DefaultModel string          `yaml:"default_model"`
	Vision       bool            `yaml:"vision,omitempty"`
	Thinking     *ThinkingConfig `yaml:"thinking"`
}

// Catalog holds named provider profiles loaded from providers.yaml.
type Catalog struct {
	entries     map[string]ProfileEntry
	credLookup  func(string) string
}

// CatalogFile is the on-disk providers.yaml shape.
type CatalogFile struct {
	Providers map[string]ProfileEntry `yaml:"providers"`
}

// LoadCatalog reads providers.yaml. credLookup is an optional fallback for API key resolution
// (e.g. from a credentials file); pass nil to use environment variables only.
func LoadCatalog(path string, credLookup func(string) string) (*Catalog, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read providers %q: %w", path, err)
	}
	var file CatalogFile
	if err := yaml.Unmarshal(data, &file); err != nil {
		return nil, fmt.Errorf("parse providers %q: %w", path, err)
	}
	if len(file.Providers) == 0 {
		return nil, fmt.Errorf("providers %q: at least one provider is required", path)
	}

	for name, entry := range file.Providers {
		if err := entry.validate(); err != nil {
			return nil, fmt.Errorf("provider %q: %w", name, err)
		}
	}

	return &Catalog{entries: file.Providers, credLookup: credLookup}, nil
}

func (e ProfileEntry) validate() error {
	if e.Type == "" {
		return fmt.Errorf("type is required")
	}
	if e.Type != KindAnthropic && e.Type != KindOpenAI {
		return fmt.Errorf("unsupported type %q", e.Type)
	}
	if e.APIKeyEnv == "" {
		return fmt.Errorf("api_key_env is required")
	}
	if looksLikeAPIKey(e.APIKeyEnv) {
		return fmt.Errorf("api_key_env must be an environment variable name (e.g. ANTHROPIC_API_KEY), not the key value itself")
	}
	return nil
}

func lookupAPIKey(envName string, credLookup func(string) string) string {
	if v := os.Getenv(envName); v != "" {
		return v
	}
	if credLookup != nil {
		return credLookup(envName)
	}
	return ""
}

func looksLikeAPIKey(s string) bool {
	return strings.HasPrefix(s, "sk-") || strings.HasPrefix(s, "sk_")
}

func (e ProfileEntry) resolve(name string, credLookup func(string) string) (Profile, error) {
	apiKey := lookupAPIKey(e.APIKeyEnv, credLookup)
	if apiKey == "" {
		return Profile{}, fmt.Errorf("API key for %q not found; run: agent-server config set-key %s <key>", e.APIKeyEnv, e.APIKeyEnv)
	}

	baseURL := e.BaseURL
	if baseURL == "" {
		switch e.Type {
		case KindAnthropic:
			baseURL = defaultAnthropicBaseURL
		case KindOpenAI:
			baseURL = defaultOpenAIBaseURL
		}
	}

	apiVersion := e.APIVersion
	if e.Type == KindAnthropic && apiVersion == "" {
		apiVersion = defaultAnthropicVersion
	}

	return Profile{
		Name:       name,
		Kind:       e.Type,
		BaseURL:    baseURL,
		APIKey:     apiKey,
		APIVersion: apiVersion,
		Vision:     e.Vision,
		Thinking:   e.Thinking,
	}, nil
}

// Get returns a resolved provider profile by name.
func (c *Catalog) Get(name string) (Profile, error) {
	entry, ok := c.entries[name]
	if !ok {
		return Profile{}, fmt.Errorf("provider %q not found", name)
	}
	return entry.resolve(name, c.credLookup)
}

// Names returns configured provider names.
func (c *Catalog) Names() []string {
	names := make([]string, 0, len(c.entries))
	for name := range c.entries {
		names = append(names, name)
	}
	return names
}

// ProviderInfo returns summary information about a provider (without secrets).
type ProviderInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	BaseURL      string `json:"base_url"`
	DefaultModel string `json:"default_model"`
	Vision       bool   `json:"vision"`
}

// Entries returns all configured providers as ProviderInfo (without API keys).
func (c *Catalog) Entries() []ProviderInfo {
	infos := make([]ProviderInfo, 0, len(c.entries))
	for name, entry := range c.entries {
		infos = append(infos, ProviderInfo{
			Name:         name,
			Type:         string(entry.Type),
			BaseURL:      entry.BaseURL,
			DefaultModel: entry.DefaultModel,
			Vision:       entry.Vision,
		})
	}
	return infos
}

// NewProvider creates a Provider from a profile.
func NewProvider(profile Profile) (Provider, error) {
	switch profile.Kind {
	case KindAnthropic:
		return NewAnthropic(AnthropicConfig{
			APIKey:     profile.APIKey,
			BaseURL:    profile.BaseURL,
			APIVersion: profile.APIVersion,
		})
	case KindOpenAI:
		return NewOpenAI(OpenAIConfig{
			APIKey:   profile.APIKey,
			BaseURL:  profile.BaseURL,
			Thinking: profile.Thinking,
		})
	default:
		return nil, fmt.Errorf("unsupported provider kind %q", profile.Kind)
	}
}

// ResolveForAgent returns a provider for the agent's provider name.
func (c *Catalog) ResolveForAgent(providerName string) (Provider, error) {
	profile, err := c.Get(providerName)
	if err != nil {
		return nil, err
	}
	return NewProvider(profile)
}
