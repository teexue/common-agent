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
	// Models is the user-selected subset available for conversation.
	Models     []string
	ModelsPath string
	Vision     bool
	Thinking   *ThinkingConfig
	// KeepAlive is the Ollama model keep-alive duration (e.g. "5m", "0").
	// Only meaningful for StyleOllama; ignored by other styles.
	KeepAlive string
	// ModelWindows maps model id → context window in tokens, captured when
	// the provider is configured (e.g. Ollama /api/show).
	ModelWindows map[string]int
}

// ProfileEntry is a provider definition (SQLite spec JSON / catalog file YAML).
type ProfileEntry struct {
	APIStyle     APIStyle  `yaml:"api_style"`
	BaseURL      string    `yaml:"base_url"`
	APIKeyEnv    string    `yaml:"api_key_env"`
	APIVersion   string    `yaml:"api_version"`
	AuthStyle    AuthStyle `yaml:"auth_style,omitempty"`
	DefaultModel string    `yaml:"default_model"`
	DisplayName  string    `yaml:"display_name,omitempty"`
	// Models is the subset of vendor models enabled for conversation.
	// Empty means only DefaultModel is available (legacy providers).
	Models     []string        `yaml:"models,omitempty" json:"models,omitempty"`
	ModelsPath string          `yaml:"models_path,omitempty"`
	Vision     bool            `yaml:"vision,omitempty"`
	Thinking   *ThinkingConfig `yaml:"thinking"`
	KeepAlive  string          `yaml:"keep_alive,omitempty" json:"keep_alive,omitempty"`
	// ModelWindows maps model id → context window in tokens, captured when
	// the provider is saved so agents can use the real window instead of 128K.
	ModelWindows map[string]int `yaml:"model_windows,omitempty" json:"model_windows,omitempty"`
}

// Catalog holds named provider profiles.
type Catalog struct {
	entries    map[string]ProfileEntry
	credLookup func(string) string
}

// CatalogFile is the legacy providers.yaml shape used by file migration and tests.
type CatalogFile struct {
	Providers map[string]ProfileEntry `yaml:"providers"`
}

// NewCatalog builds a Catalog from in-memory entries (e.g. loaded from SQLite).
// An empty map is reported via IsMissingCatalogError.
func NewCatalog(entries map[string]ProfileEntry, credLookup func(string) string) (*Catalog, error) {
	if len(entries) == 0 {
		return nil, &missingCatalogError{path: "db", empty: true}
	}
	for name, entry := range entries {
		if err := entry.validate(); err != nil {
			return nil, fmt.Errorf("provider %q: %w", name, err)
		}
	}
	return &Catalog{entries: entries, credLookup: credLookup}, nil
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
	return NewCatalog(file.Providers, credLookup)
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
	if e.APIStyle != StyleAnthropic && e.APIStyle != StyleOpenAI && e.APIStyle != StyleOllama {
		return fmt.Errorf("unsupported api_style %q", e.APIStyle)
	}
	// Local Ollama needs no API key, so api_key_env is optional for that style.
	// When set (e.g. ollama_cloud), it must be a variable name, not the key itself.
	if e.APIKeyEnv == "" && e.APIStyle != StyleOllama {
		return fmt.Errorf("api_key_env is required")
	}
	if e.APIKeyEnv != "" && looksLikeAPIKey(e.APIKeyEnv) {
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
	// A configured api_key_env means a key is required (e.g. ollama_cloud).
	// An empty api_key_env (local Ollama) means no key is needed.
	if e.APIKeyEnv != "" && apiKey == "" {
		return Profile{}, fmt.Errorf("API key for %q not found; run: agent-server config set-key %s <key>", e.APIKeyEnv, e.APIKeyEnv)
	}

	vendor, hasVendor := LookupVendor(name)
	baseURL := resolveBaseURL(e, vendor, hasVendor)
	apiVersion := e.APIVersion
	if apiVersion == "" && hasVendor && vendor.APIVersion != "" {
		apiVersion = vendor.APIVersion
	}
	if e.APIStyle == StyleAnthropic && apiVersion == "" {
		apiVersion = defaultAnthropicVersion
	}
	authStyle := resolveAuthStyle(e, vendor, hasVendor)
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
		Models:       EnabledModels(e),
		ModelsPath:   modelsPath,
		Vision:       e.Vision,
		Thinking:     e.Thinking,
		KeepAlive:    e.KeepAlive,
		ModelWindows: e.ModelWindows,
	}, nil
}

func resolveBaseURL(e ProfileEntry, vendor Vendor, hasVendor bool) string {
	if e.BaseURL != "" {
		return e.BaseURL
	}
	if hasVendor {
		if u := vendor.BaseURLFor(e.APIStyle); u != "" {
			return u
		}
	}
	return defaultBaseURLFor(e.APIStyle)
}

func resolveAuthStyle(e ProfileEntry, vendor Vendor, hasVendor bool) AuthStyle {
	if e.AuthStyle != "" {
		return e.AuthStyle
	}
	if hasVendor {
		return vendor.AuthForStyle(e.APIStyle)
	}
	if e.APIStyle == StyleAnthropic {
		return AuthXAPIKey
	}
	return AuthBearer
}

func defaultBaseURLFor(style APIStyle) string {
	return DefaultBaseURLFor(style)
}

// DefaultBaseURLFor returns the default API base URL for an API style.
func DefaultBaseURLFor(style APIStyle) string {
	switch style {
	case StyleAnthropic:
		return defaultAnthropicBaseURL
	case StyleOllama:
		return defaultOllamaBaseURL
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

// ModelContextWindow returns the context window saved on the provider for
// model. 0 means the provider has no recorded window for that model.
func (c *Catalog) ModelContextWindow(providerName, model string) int {
	if c == nil || providerName == "" || model == "" {
		return 0
	}
	e, ok := c.entries[providerName]
	if !ok {
		return 0
	}
	return e.ModelWindows[model]
}

// MergeModelWindows copies src over dst. Zero or empty keys are ignored.
// The result is nil when empty so YAML/JSON omitempty stays quiet.
func MergeModelWindows(dst, src map[string]int) map[string]int {
	if len(dst) == 0 && len(src) == 0 {
		return nil
	}
	out := make(map[string]int, len(dst)+len(src))
	for k, v := range dst {
		if v > 0 {
			out[k] = v
		}
	}
	for k, v := range src {
		if v > 0 {
			out[k] = v
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// ProviderInfo returns summary information about a provider (without secrets).
type ProviderInfo struct {
	Name          string         `json:"name"`
	APIStyle      APIStyle       `json:"api_style"`
	AuthStyle     AuthStyle      `json:"auth_style,omitempty"`
	DisplayName   string         `json:"display_name"`
	BaseURL       string         `json:"base_url"`
	DefaultModel  string         `json:"default_model"`
	Models        []string       `json:"models,omitempty"`
	ModelsPath    string         `json:"models_path"`
	Vision        bool           `json:"vision"`
	APIKeyEnv     string         `json:"api_key_env,omitempty"`
	ModelWindows  map[string]int `json:"model_windows,omitempty"`
	ContextWindow int            `json:"context_window,omitempty"` // default_model's saved window
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
			Name:          name,
			APIStyle:      entry.APIStyle,
			AuthStyle:     authStyle,
			DisplayName:   displayName,
			BaseURL:       baseURL,
			DefaultModel:  entry.DefaultModel,
			Models:        EnabledModels(entry),
			ModelsPath:    modelsPath,
			Vision:        entry.Vision,
			APIKeyEnv:     entry.APIKeyEnv,
			ModelWindows:  entry.ModelWindows,
			ContextWindow: entry.ModelWindows[entry.DefaultModel],
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
	case StyleOllama:
		o, err := NewOllama(OllamaConfig{
			APIKey:     profile.APIKey,
			BaseURL:    profile.BaseURL,
			Thinking:   profile.Thinking,
			ModelsPath: profile.ModelsPath,
			Vision:     profile.Vision,
			KeepAlive:  profile.KeepAlive,
		})
		if err != nil {
			return nil, err
		}
		o.seedContextWindows(profile.ModelWindows)
		return o, nil
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

// ShowModel returns structured metadata for a single model from a configured
// provider. Providers that do not implement ModelDetailer return an error.
func (c *Catalog) ShowModel(ctx context.Context, name, model string) (ModelDetail, error) {
	profile, err := c.Get(name)
	if err != nil {
		return ModelDetail{}, err
	}
	p, err := NewProvider(ListingProfile(profile))
	if err != nil {
		return ModelDetail{}, err
	}
	detailer, ok := p.(ModelDetailer)
	if !ok {
		return ModelDetail{}, fmt.Errorf("provider %q does not support model detail", name)
	}
	return detailer.ShowModel(ctx, model)
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
		Name:       profile.Name,
		APIStyle:   StyleOpenAI,
		BaseURL:    v.OpenAIBaseURL,
		APIKey:     profile.APIKey,
		AuthStyle:  AuthBearer,
		ModelsPath: DefaultModelsPathFor(StyleOpenAI),
		Vision:     profile.Vision,
	}
}
