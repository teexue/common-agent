package config

import (
	"fmt"
	"os"

	"github.com/teexue/common-agent/core/embedding"
	"github.com/teexue/common-agent/core/store"
	"gopkg.in/yaml.v3"
)

// Settings holds user-level defaults.
type Settings struct {
	DefaultAgent string            `yaml:"default_agent"`
	Locale       string            `yaml:"locale,omitempty"`
	Embedding    *embedding.Config `yaml:"embedding,omitempty"`
}

// LoadSettings reads settings from SQLite when bound, else config.yaml.
func LoadSettings(home string) (Settings, error) {
	if stateDB != nil {
		s, err := stateDB.LoadSettings()
		if err != nil {
			return Settings{}, err
		}
		return Settings{DefaultAgent: s.DefaultAgent, Locale: s.Locale, Embedding: s.Embedding}, nil
	}
	return loadSettingsFile(home)
}

// SaveSettings writes settings to SQLite when bound, else config.yaml.
func SaveSettings(home string, s Settings) error {
	if stateDB != nil {
		return stateDB.SaveSettings(store.Settings{
			DefaultAgent: s.DefaultAgent,
			Locale:       s.Locale,
			Embedding:    s.Embedding,
		})
	}
	return saveSettingsFile(home, s)
}

func loadSettingsFile(home string) (Settings, error) {
	path := SettingsFile(home)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Settings{DefaultAgent: "chat-assistant", Locale: "zh-CN"}, nil
		}
		return Settings{}, fmt.Errorf("read settings: %w", err)
	}
	var s Settings
	if err := yaml.Unmarshal(data, &s); err != nil {
		return Settings{}, fmt.Errorf("parse settings: %w", err)
	}
	if s.DefaultAgent == "" {
		s.DefaultAgent = "chat-assistant"
	}
	if s.Locale == "" {
		s.Locale = "zh-CN"
	}
	if s.Embedding != nil {
		n := s.Embedding.Normalize()
		s.Embedding = &n
	}
	return s, nil
}

func saveSettingsFile(home string, s Settings) error {
	if err := ensureHome(home); err != nil {
		return err
	}
	data, err := yaml.Marshal(s)
	if err != nil {
		return fmt.Errorf("marshal settings: %w", err)
	}
	return os.WriteFile(SettingsFile(home), data, 0o644)
}

func ensureHome(home string) error {
	if err := os.MkdirAll(home, 0o755); err != nil {
		return err
	}
	return os.MkdirAll(AgentsDir(home), 0o755)
}
