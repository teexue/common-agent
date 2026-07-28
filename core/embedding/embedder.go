// Package embedding provides text embedding backends for RAG retrieval.
package embedding

import (
	"context"
	"fmt"
	"log/slog"
)

// Embedder turns text into dense vectors.
type Embedder interface {
	// Embed returns one vector per input text, in the same order.
	Embed(ctx context.Context, texts []string) ([][]float32, error)
	// Dimensions returns the vector size after at least one successful Embed,
	// or 0 if unknown.
	Dimensions() int
}

// Config selects and configures an embedding backend.
// It is independent of chat providers.yaml; credentials are resolved via api_key_env.
type Config struct {
	Vendor     string `yaml:"vendor,omitempty" json:"vendor,omitempty"`
	Backend    string `yaml:"backend" json:"backend"` // openai | ollama
	BaseURL    string `yaml:"base_url" json:"base_url"`
	APIKeyEnv  string `yaml:"api_key_env,omitempty" json:"api_key_env,omitempty"`
	Model      string `yaml:"model" json:"model"`
	Dimensions int    `yaml:"dimensions,omitempty" json:"dimensions,omitempty"` // OpenAI-compatible; 0 = provider default
	APIKey     string `yaml:"-" json:"-"`                                       // resolved at runtime / request-only, never persisted

	// LegacyProvider is accepted only when unmarshaling old config.yaml that
	// referenced a chat providers.yaml profile. It is ignored after load.
	LegacyProvider string `yaml:"provider,omitempty" json:"-"`
}

// Public view fields returned by GET /v1/embedding (no secrets).
type ConfigView struct {
	Vendor     string `json:"vendor,omitempty"`
	Backend    string `json:"backend"`
	BaseURL    string `json:"base_url"`
	APIKeyEnv  string `json:"api_key_env,omitempty"`
	Model      string `json:"model"`
	Dimensions int    `json:"dimensions,omitempty"`
	HasAPIKey  bool   `json:"has_api_key"`
}

// Backend names.
const (
	BackendOpenAI = "openai"
	BackendOllama = "ollama"
)

// Validate checks Config fields after Normalize.
func (c Config) Validate() error {
	switch c.Backend {
	case BackendOpenAI:
		if c.Model == "" {
			return fmt.Errorf("embedding.model is required")
		}
		if c.BaseURL == "" {
			return fmt.Errorf("embedding.base_url is required")
		}
		if c.APIKey == "" && c.APIKeyEnv == "" {
			return fmt.Errorf("embedding.api_key_env is required")
		}
	case BackendOllama:
		if c.Model == "" {
			return fmt.Errorf("embedding.model is required")
		}
	default:
		return fmt.Errorf("unsupported embedding.backend %q", c.Backend)
	}
	return nil
}

// Normalize fills defaults from vendor presets when fields are empty.
// Legacy provider references are cleared with a warning.
func (c Config) Normalize() Config {
	if c.LegacyProvider != "" {
		slog.Warn("log.embedding.legacy_provider_ignored", "provider", c.LegacyProvider)
		c.LegacyProvider = ""
	}
	if c.Vendor != "" {
		if v, ok := LookupVendor(c.Vendor); ok {
			if c.Backend == "" {
				c.Backend = v.Backend
			}
			if c.BaseURL == "" {
				c.BaseURL = v.BaseURL
			}
			if c.APIKeyEnv == "" {
				c.APIKeyEnv = v.APIKeyEnv
			}
			if c.Model == "" {
				c.Model = v.DefaultModel
			}
			if c.Dimensions == 0 && v.DefaultDimensions > 0 {
				c.Dimensions = v.DefaultDimensions
			}
		}
	}
	if c.Backend == "" {
		c.Backend = BackendOpenAI
	}
	if c.Backend == BackendOllama && c.BaseURL == "" {
		c.BaseURL = "http://127.0.0.1:11434"
	}
	return c
}

// Persistable returns a copy safe to write to config.yaml (no runtime secrets).
func (c Config) Persistable() Config {
	return Config{
		Vendor:     c.Vendor,
		Backend:    c.Backend,
		BaseURL:    c.BaseURL,
		APIKeyEnv:  c.APIKeyEnv,
		Model:      c.Model,
		Dimensions: c.Dimensions,
	}
}

// View returns a JSON-safe view of the config.
func (c Config) View(hasAPIKey bool) ConfigView {
	return ConfigView{
		Vendor:     c.Vendor,
		Backend:    c.Backend,
		BaseURL:    c.BaseURL,
		APIKeyEnv:  c.APIKeyEnv,
		Model:      c.Model,
		Dimensions: c.Dimensions,
		HasAPIKey:  hasAPIKey,
	}
}
