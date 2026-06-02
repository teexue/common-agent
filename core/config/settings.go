package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Settings holds user-level defaults.
type Settings struct {
	DefaultScenario string `yaml:"default_scenario"`
}

// LoadSettings reads config.yaml from home. Missing file returns defaults.
func LoadSettings(home string) (Settings, error) {
	path := SettingsFile(home)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Settings{DefaultScenario: "demo"}, nil
		}
		return Settings{}, fmt.Errorf("read settings: %w", err)
	}
	var s Settings
	if err := yaml.Unmarshal(data, &s); err != nil {
		return Settings{}, fmt.Errorf("parse settings: %w", err)
	}
	if s.DefaultScenario == "" {
		s.DefaultScenario = "demo"
	}
	return s, nil
}

// SaveSettings writes config.yaml.
func SaveSettings(home string, s Settings) error {
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
	return os.MkdirAll(ScenariosDir(home), 0o755)
}
