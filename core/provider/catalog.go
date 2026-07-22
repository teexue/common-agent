package provider

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Profile is a resolved provider configuration.
type Profile struct {
	Name         string
	APIStyle     APIStyle
	BaseURL      string
	APIKey       string
	APIVersion   string
	AuthStyle    AuthStyle
	DisplayName  string
	DefaultModel string
	ModelsPath   string
	Vision       bool
	Thinking     *ThinkingConfig
}

// ProfileEntry is a provider definition in providers.yaml.
type ProfileEntry struct {
	APIStyle     APIStyle       `yaml:"api_style"`
	BaseURL      string         `yaml:"base_url"`
	APIKeyEnv    string         `yaml:"api_key_env"`
	APIVersion   string         `yaml:"api_version"`
	AuthStyle    AuthStyle      `yaml:"auth_style,omitempty"`
	DefaultModel string         `yaml:"default_model"`
	DisplayName string         `yaml:"display_name,omitempty"`
	ModelsPath   string         `yaml:"models_path,omitempty"`
	Vision       bool           `yaml:"vision,omitempty"`
	Thinking     *ThinkingConfig `yaml:"thinking"`
}

// Catalog holds named provider profiles loaded from providers.yaml.
type Catalog struct {
	entries    map[string]ProfileEntry
	credLookup func(string) string
}

// CatalogFile is the on-disk providers.yaml shape.
type CatalogFile struct {
	Providers map[string]ProfileEntry `yaml:"providers"`
}

// LoadCatalog reads providers.yaml. credLookup is an optional fallback for API key resolution
// (e.g. from a credentials file); pass nil to use environment variables only.
// A missing file or an empty providers map is reported via IsMissingCatalogError and
// is treated as "no providers configured" rather than a hard failure.
func LoadCatalog(path string, credLookup func(string) string) (*Catalog, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, &missingCatalogError{path: path}
		}
		return nil, fmt.Errorf("read providers %q: %w", path, err)
	}
	var file CatalogFile
	if err := yaml.Unmarshal(data, &file); err != nil {
		return nil, fmt.Errorf("parse providers %q: %w", path, err)
	}
	if len(file.Providers) == 0 {
		return nil, &missingCatalogError{path: path, empty: true}
	}

	for name, entry := range file.Providers {
		if err := entry.validate(); err != nil {
			return nil, fmt.Errorf("provider %q: %w", name, err)
		}
	}

	return &Catalog{entries: file.Providers, credLookup: credLookup}, nil
}

// missingCatalogError indicates the providers file is absent or contains no providers.
type missingCatalogError struct {
	path  string
	empty bool
}

func (e *missingCatalogError) Error() string {
	if e.empty {
		return fmt.Sprintf("providers %q: no providers configured", e.path)
	}
	return fmt.Sprintf("providers %q: not found", e.path)
}

// IsMissingCatalogError reports whether err means the catalog is absent or empty.
func IsMissingCatalogError(err error) bool {
	var m *missingCatalogError
	return errors.As(err, &m)
}

func (e ProfileEntry) validate() error {
	if e.APIStyle == "" {
		return fmt.Errorf("api_style is required")
	}
	if e.APIStyle != StyleAnthropic && e.APIStyle != StyleOpenAI {
		return fmt.Errorf("unsupported api_style %q", e.APIStyle)
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

	vendor, hasVendor := LookupVendor(name)

	baseURL := e.BaseURL
	if baseURL == "" {
		if hasVendor {
			baseURL = vendor.BaseURLFor(e.APIStyle)
		}
		if baseURL == "" {
			baseURL = defaultBaseURLFor(e.APIStyle)
		}
	}

	apiVersion := e.APIVersion
	if apiVersion == "" && hasVendor && vendor.APIVersion != "" {
		apiVersion = vendor.APIVersion
	}
	if e.APIStyle == StyleAnthropic && apiVersion == "" {
		apiVersion = defaultAnthropicVersion
	}

	authStyle := e.AuthStyle
	if authStyle == "" {
		if hasVendor {
			authStyle = vendor.AuthForStyle(e.APIStyle)
		} else if e.APIStyle == StyleAnthropic {
			authStyle = AuthXAPIKey
		} else {
			authStyle = AuthBearer
		}
	}

	modelsPath := e.ModelsPath
	if modelsPath == "" {
		modelsPath = DefaultModelsPathFor(e.APIStyle)
	}

	displayName := e.DisplayName
	if displayName == "" && hasVendor {
		displayName = vendor.DisplayName
	}

	return Profile{
		Name:         name,
		APIStyle:     e.APIStyle,
		BaseURL:      baseURL,
		APIKey:       apiKey,
		APIVersion:   apiVersion,
		AuthStyle:    authStyle,
		DisplayName:  displayName,
		DefaultModel: e.DefaultModel,
		ModelsPath:   modelsPath,
		Vision:       e.Vision,
		Thinking:     e.Thinking,
	}, nil
}

func defaultBaseURLFor(style APIStyle) string {
	return DefaultBaseURLFor(style)
}

// DefaultBaseURLFor returns the default API base URL for an API style.
func DefaultBaseURLFor(style APIStyle) string {
	switch style {
	case StyleAnthropic:
		return defaultAnthropicBaseURL
	default:
		return defaultOpenAIBaseURL
	}
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
	Name         string    `json:"name"`
	APIStyle     APIStyle  `json:"api_style"`
	AuthStyle    AuthStyle `json:"auth_style,omitempty"`
	DisplayName  string    `json:"display_name"`
	BaseURL      string    `json:"base_url"`
	DefaultModel string    `json:"default_model"`
	ModelsPath   string    `json:"models_path"`
	Vision       bool      `json:"vision"`
}

// Entries returns all configured providers as ProviderInfo (without API keys).
func (c *Catalog) Entries() []ProviderInfo {
	infos := make([]ProviderInfo, 0, len(c.entries))
	for name, entry := range c.entries {
		vendor, hasVendor := LookupVendor(name)
		modelsPath := entry.ModelsPath
		if modelsPath == "" {
			modelsPath = DefaultModelsPathFor(entry.APIStyle)
		}
		displayName := entry.DisplayName
		if displayName == "" && hasVendor {
			displayName = vendor.DisplayName
		}
		baseURL := entry.BaseURL
		if baseURL == "" {
			if hasVendor {
				baseURL = vendor.BaseURLFor(entry.APIStyle)
			}
			if baseURL == "" {
				baseURL = defaultBaseURLFor(entry.APIStyle)
			}
		}
		authStyle := entry.AuthStyle
		if authStyle == "" {
			if hasVendor {
				authStyle = vendor.AuthForStyle(entry.APIStyle)
			} else if entry.APIStyle == StyleAnthropic {
				authStyle = AuthXAPIKey
			} else {
				authStyle = AuthBearer
			}
		}
		infos = append(infos, ProviderInfo{
			Name:         name,
			APIStyle:     entry.APIStyle,
			AuthStyle:    authStyle,
			DisplayName:  displayName,
			BaseURL:      baseURL,
			DefaultModel: entry.DefaultModel,
			ModelsPath:   modelsPath,
			Vision:       entry.Vision,
		})
	}
	return infos
}

// NewProvider creates a Provider from a profile.
func NewProvider(profile Profile) (Provider, error) {
	switch profile.APIStyle {
	case StyleAnthropic:
		return NewAnthropic(AnthropicConfig{
			APIKey:     profile.APIKey,
			BaseURL:    profile.BaseURL,
			APIVersion: profile.APIVersion,
			AuthStyle:  profile.AuthStyle,
			ModelsPath: profile.ModelsPath,
			Vision:     profile.Vision,
		})
	case StyleOpenAI:
		return NewOpenAI(OpenAIConfig{
			APIKey:     profile.APIKey,
			BaseURL:    profile.BaseURL,
			Thinking:   profile.Thinking,
			ModelsPath: profile.ModelsPath,
			Vision:     profile.Vision,
		})
	default:
		return nil, fmt.Errorf("unsupported provider api_style %q", profile.APIStyle)
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

// ListModels fetches the model catalog for a named provider.
// Requires a valid API key; returns an error if the provider is unknown or
// the implementation does not support model listing.
func (c *Catalog) ListModels(ctx context.Context, name string) ([]ModelInfo, error) {
	profile, err := c.Get(name)
	if err != nil {
		return nil, err
	}
	p, err := NewProvider(ListingProfile(profile))
	if err != nil {
		return nil, err
	}
	lister, ok := p.(ModelLister)
	if !ok {
		return nil, fmt.Errorf("provider %q does not support model listing", name)
	}
	return lister.ListModels(ctx)
}

// ListingProfile returns a Profile tuned for model listing.
// Dual-protocol vendors (moonshot/deepseek/zhipu) only expose /models on their
// OpenAI-compatible endpoint — their Anthropic endpoint does not serve a model
// list. So when the configured style is Anthropic but the vendor also speaks
// OpenAI, we transparently list via the OpenAI endpoint using the same API key.
// Pure-Anthropic vendors (e.g. Anthropic itself) keep their native style.
func ListingProfile(profile Profile) Profile {
	v, ok := LookupVendor(profile.Name)
	if !ok || !v.SupportsStyle(StyleOpenAI) {
		return profile
	}
	if profile.APIStyle == StyleOpenAI {
		return profile
	}
	if profile.BaseURL != "" && profile.BaseURL != v.AnthropicBaseURL {
		return profile
	}
	return Profile{
		Name:         profile.Name,
		APIStyle:     StyleOpenAI,
		BaseURL:      v.OpenAIBaseURL,
		APIKey:       profile.APIKey,
		AuthStyle:    AuthBearer,
		ModelsPath:   DefaultModelsPathFor(StyleOpenAI),
		Vision:       profile.Vision,
	}
}
