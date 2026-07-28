package store

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
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
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Prefix    string    `json:"prefix"`
	CreatedAt time.Time `json:"created_at"`
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
			Prefix: k.Prefix, CreatedAt: k.CreatedAt,
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

// AddAPIKey stores a client-generated key hash bound to userID.
// The raw key is never persisted.
func (db *DB) AddAPIKey(userID, name, rawKey string) (APIKey, error) {
	userID = strings.TrimSpace(userID)
	name = strings.TrimSpace(name)
	rawKey = strings.TrimSpace(rawKey)
	if userID == "" {
		return APIKey{}, fmt.Errorf("user_id is required")
	}
	if name == "" {
		return APIKey{}, fmt.Errorf("name is required")
	}
	if rawKey == "" {
		return APIKey{}, fmt.Errorf("key is required")
	}
	id, err := generateID("ak")
	if err != nil {
		return APIKey{}, err
	}
	entry := APIKey{
		ID:        id,
		UserID:    userID,
		Name:      name,
		KeyHash:   HashAPIKey(rawKey),
		Prefix:    KeyPrefix(rawKey),
		CreatedAt: time.Now().UTC(),
	}
	if err := db.Create(&entry).Error; err != nil {
		return APIKey{}, fmt.Errorf("create api key: %w", err)
	}
	return entry, nil
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

// VerifyAPIKey finds a key matching the raw secret (constant-time hash compare).
func (db *DB) VerifyAPIKey(rawKey string) (APIKey, bool, error) {
	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		return APIKey{}, false, nil
	}
	want := HashAPIKey(rawKey)
	var rows []APIKey
	if err := db.Find(&rows).Error; err != nil {
		return APIKey{}, false, err
	}
	for _, k := range rows {
		if subtle.ConstantTimeCompare([]byte(k.KeyHash), []byte(want)) == 1 {
			return k, true, nil
		}
	}
	return APIKey{}, false, nil
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
