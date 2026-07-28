package store

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

const (
	metaJWTSecret         = "jwt_secret"
	metaMigratedAPIKeys   = "migrated_api_keys"
	metaMigratedSettings  = "migrated_settings"
	metaMigratedProviders = "migrated_providers"
	metaMigratedCreds     = "migrated_credentials"
	metaMigratedMCP       = "migrated_mcp"
	metaMigratedSessions  = "migrated_sessions"
)

// GetMeta returns a meta value or empty string.
func (db *DB) GetMeta(key string) (string, error) {
	var m Meta
	err := db.Where("key = ?", key).First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil
		}
		return "", err
	}
	return m.Value, nil
}

// SetMeta upserts a meta key/value.
func (db *DB) SetMeta(key, value string) error {
	m := Meta{Key: key, Value: value}
	return db.Save(&m).Error
}

// EnsureJWTSecret returns the JWT HMAC secret, generating one if missing.
func (db *DB) EnsureJWTSecret() ([]byte, error) {
	v, err := db.GetMeta(metaJWTSecret)
	if err != nil {
		return nil, err
	}
	if v != "" {
		b, err := hex.DecodeString(v)
		if err != nil {
			return nil, fmt.Errorf("decode jwt secret: %w", err)
		}
		return b, nil
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, fmt.Errorf("generate jwt secret: %w", err)
	}
	if err := db.SetMeta(metaJWTSecret, hex.EncodeToString(raw)); err != nil {
		return nil, err
	}
	return raw, nil
}
