package store

import (
	"encoding/json"
	"fmt"

	"github.com/teexue/common-agent/core/embedding"
)

const (
	settingDefaultAgent = "default_agent"
	settingLocale       = "locale"
	settingEmbedding    = "embedding"
)

// Settings mirrors config.Settings for persistence.
type Settings struct {
	DefaultAgent string
	Locale       string
	Embedding    *embedding.Config
}

// LoadSettings reads settings from the DB with defaults.
func (db *DB) LoadSettings() (Settings, error) {
	s := Settings{DefaultAgent: "chat-assistant", Locale: "zh-CN"}
	if v, err := db.getSetting(settingDefaultAgent); err != nil {
		return Settings{}, err
	} else if v != "" {
		s.DefaultAgent = v
	}
	if v, err := db.getSetting(settingLocale); err != nil {
		return Settings{}, err
	} else if v != "" {
		s.Locale = v
	}
	if v, err := db.getSetting(settingEmbedding); err != nil {
		return Settings{}, err
	} else if v != "" {
		var emb embedding.Config
		if err := json.Unmarshal([]byte(v), &emb); err != nil {
			return Settings{}, fmt.Errorf("parse embedding settings: %w", err)
		}
		n := emb.Normalize()
		s.Embedding = &n
	}
	return s, nil
}

// SaveSettings writes settings to the DB.
func (db *DB) SaveSettings(s Settings) error {
	if s.DefaultAgent == "" {
		s.DefaultAgent = "chat-assistant"
	}
	if s.Locale == "" {
		s.Locale = "zh-CN"
	}
	if err := db.setSetting(settingDefaultAgent, s.DefaultAgent); err != nil {
		return err
	}
	if err := db.setSetting(settingLocale, s.Locale); err != nil {
		return err
	}
	if s.Embedding == nil {
		return db.Where("key = ?", settingEmbedding).Delete(&Setting{}).Error
	}
	n := s.Embedding.Normalize()
	b, err := json.Marshal(n)
	if err != nil {
		return fmt.Errorf("marshal embedding: %w", err)
	}
	return db.setSetting(settingEmbedding, string(b))
}

func (db *DB) getSetting(key string) (string, error) {
	var row Setting
	err := db.Where("key = ?", key).First(&row).Error
	if err != nil {
		if isNotFound(err) {
			return "", nil
		}
		return "", err
	}
	return row.Value, nil
}

func (db *DB) setSetting(key, value string) error {
	return db.Save(&Setting{Key: key, Value: value}).Error
}
