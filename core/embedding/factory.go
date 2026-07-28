package embedding

import "fmt"

// KeyLookup resolves an API key from an environment variable name
// (typically config.CredentialStore.Lookup).
type KeyLookup func(envName string) string

// New creates an Embedder from Config.
// lookup may be nil when cfg.APIKey is already set or backend is ollama.
func New(cfg Config, lookup KeyLookup) (Embedder, error) {
	cfg = cfg.Normalize()
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	switch cfg.Backend {
	case BackendOllama:
		return NewOllama(OllamaConfig{
			BaseURL: cfg.BaseURL,
			Model:   cfg.Model,
		})
	default:
		apiKey := cfg.APIKey
		if apiKey == "" && cfg.APIKeyEnv != "" && lookup != nil {
			apiKey = lookup(cfg.APIKeyEnv)
		}
		if apiKey == "" {
			return nil, fmt.Errorf("embedding: API key for %q not found; set it in Settings or env", cfg.APIKeyEnv)
		}
		maxBatch := 0
		if v, ok := LookupVendor(cfg.Vendor); ok {
			maxBatch = v.MaxBatch
		}
		return NewOpenAI(OpenAIConfig{
			APIKey:     apiKey,
			BaseURL:    cfg.BaseURL,
			Model:      cfg.Model,
			Dimensions: cfg.Dimensions,
			MaxBatch:   maxBatch,
		})
	}
}
