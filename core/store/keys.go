package store

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"
)

// APIKeyInfo is a redacted view of an API key.
type APIKeyInfo struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	Scopes     string     `json:"scopes"`
	Enabled    bool       `json:"enabled"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// ListAPIKeys returns redacted keys for a user (empty userID = all).
func (db *DB) ListAPIKeys(userID string) ([]APIKeyInfo, error) {
	q := db.Model(&APIKey{}).Order("created_at desc")
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	}
	var rows []APIKey
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]APIKeyInfo, 0, len(rows))
	for _, k := range rows {
		out = append(out, APIKeyInfo{
			ID: k.ID, UserID: k.UserID, Name: k.Name,
			Prefix: k.Prefix, Scopes: k.Scopes, Enabled: k.Enabled,
			ExpiresAt: k.ExpiresAt, LastUsedAt: k.LastUsedAt,
			CreatedAt: k.CreatedAt,
		})
	}
	return out, nil
}

// CountAPIKeys returns the total number of API keys.
func (db *DB) CountAPIKeys() (int64, error) {
	var n int64
	err := db.Model(&APIKey{}).Count(&n).Error
	return n, err
}

// AddAPIKey generates a server-side key ("ca_" + 48 hex chars), stores its
// SHA-256 hash bound to userID, and returns the raw key exactly once.
// An empty scopes defaults to "*" (all scopes).
func (db *DB) AddAPIKey(userID, name, scopes string, expiresAt *time.Time) (string, *APIKey, error) {
	userID = strings.TrimSpace(userID)
	name = strings.TrimSpace(name)
	scopes = strings.TrimSpace(scopes)
	if userID == "" {
		return "", nil, fmt.Errorf("user_id is required")
	}
	if name == "" {
		return "", nil, fmt.Errorf("name is required")
	}
	if scopes == "" {
		scopes = "*"
	}
	rawKey, err := generateAPIKey()
	if err != nil {
		return "", nil, err
	}
	id, err := generateID("ak")
	if err != nil {
		return "", nil, err
	}
	entry := APIKey{
		ID:        id,
		UserID:    userID,
		Name:      name,
		KeyHash:   HashAPIKey(rawKey),
		Prefix:    KeyPrefix(rawKey),
		Scopes:    scopes,
		ExpiresAt: expiresAt,
		Enabled:   true,
		CreatedAt: time.Now().UTC(),
	}
	if err := db.Create(&entry).Error; err != nil {
		return "", nil, fmt.Errorf("create api key: %w", err)
	}
	return rawKey, &entry, nil
}

// DeleteAPIKey removes a key by id. Optionally scoped to userID.
func (db *DB) DeleteAPIKey(id, userID string) error {
	if id == "" {
		return fmt.Errorf("id is required")
	}
	q := db.Where("id = ?", id)
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	}
	res := q.Delete(&APIKey{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("api key %q: %w", id, os.ErrNotExist)
	}
	return nil
}

// GetAPIKey returns a key by id.
func (db *DB) GetAPIKey(id string) (APIKey, error) {
	var k APIKey
	err := db.Where("id = ?", id).First(&k).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return APIKey{}, fmt.Errorf("api key %q: %w", id, os.ErrNotExist)
	}
	return k, err
}

// HasAPIKeyID reports whether a key id still exists.
func (db *DB) HasAPIKeyID(id string) bool {
	var n int64
	_ = db.Model(&APIKey{}).Where("id = ?", id).Count(&n).Error
	return n > 0
}

// APIKeyPatch describes editable fields of an API key; nil fields are untouched.
type APIKeyPatch struct {
	Name    *string
	Scopes  *string
	Enabled *bool
}

// UpdateAPIKey applies a patch to a key by id. Optionally scoped to userID.
func (db *DB) UpdateAPIKey(id, userID string, patch APIKeyPatch) error {
	if id == "" {
		return fmt.Errorf("id is required")
	}
	updates := map[string]any{}
	if patch.Name != nil {
		name := strings.TrimSpace(*patch.Name)
		if name == "" {
			return fmt.Errorf("name must not be empty")
		}
		updates["name"] = name
	}
	if patch.Scopes != nil {
		scopes := strings.TrimSpace(*patch.Scopes)
		if scopes == "" {
			return fmt.Errorf("scopes must not be empty")
		}
		updates["scopes"] = scopes
	}
	if patch.Enabled != nil {
		updates["enabled"] = *patch.Enabled
	}
	if len(updates) == 0 {
		return nil
	}
	q := db.Model(&APIKey{}).Where("id = ?", id)
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	}
	res := q.Updates(updates)
	if res.Error != nil {
		return fmt.Errorf("update api key: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("api key %q: %w", id, os.ErrNotExist)
	}
	return nil
}

// VerifyAPIKey looks up a key by its SHA-256 hash (indexed) and returns it
// when enabled and not expired. A hit updates last_used_at.
// (nil, nil) means the key does not authenticate.
func (db *DB) VerifyAPIKey(rawKey string) (*APIKey, error) {
	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		return nil, nil
	}
	var k APIKey
	err := db.Where("key_hash = ?", HashAPIKey(rawKey)).First(&k).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !k.Enabled {
		return nil, nil
	}
	if k.ExpiresAt != nil && !time.Now().Before(*k.ExpiresAt) {
		return nil, nil
	}
	now := time.Now().UTC()
	if err := db.Model(&APIKey{}).Where("id = ?", k.ID).
		Update("last_used_at", now).Error; err != nil {
		return nil, fmt.Errorf("touch last_used_at: %w", err)
	}
	k.LastUsedAt = &now
	return &k, nil
}

// HashAPIKey returns the hex-encoded SHA-256 of the raw key.
func HashAPIKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// KeyPrefix returns a short display prefix for a raw key.
func KeyPrefix(key string) string {
	if len(key) <= 8 {
		return key
	}
	return key[:8] + "…"
}

func generateID(prefix string) (string, error) {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return prefix + "_" + hex.EncodeToString(b[:]), nil
}

// generateAPIKey returns a raw API key: "ca_" + 48 hex chars (24 random bytes).
func generateAPIKey() (string, error) {
	var b [24]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate api key: %w", err)
	}
	return "ca_" + hex.EncodeToString(b[:]), nil
}
