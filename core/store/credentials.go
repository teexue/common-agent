package store

import (
	"fmt"
	"os"
	"sync"
)

// CredentialStore is a thread-safe credential store backed by SQLite.
type CredentialStore struct {
	db    *DB
	mu    sync.RWMutex
	cache map[string]string
}

// NewCredentialStore loads credentials into an in-memory cache.
func NewCredentialStore(db *DB) (*CredentialStore, error) {
	cs := &CredentialStore{db: db, cache: map[string]string{}}
	var rows []Credential
	if err := db.Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("load credentials: %w", err)
	}
	for _, r := range rows {
		cs.cache[r.EnvName] = r.Value
	}
	return cs, nil
}

// Set stores a credential and persists it.
func (cs *CredentialStore) Set(envName, value string) error {
	if envName == "" {
		return fmt.Errorf("env name is required")
	}
	if value == "" {
		return fmt.Errorf("value is required")
	}
	cs.mu.Lock()
	defer cs.mu.Unlock()
	if err := cs.db.Save(&Credential{EnvName: envName, Value: value}).Error; err != nil {
		return fmt.Errorf("write credential: %w", err)
	}
	cs.cache[envName] = value
	return nil
}

// Get returns a stored credential by env var name.
func (cs *CredentialStore) Get(envName string) string {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return cs.cache[envName]
}

// Lookup checks the environment first, then the store.
func (cs *CredentialStore) Lookup(envName string) string {
	if v := os.Getenv(envName); v != "" {
		return v
	}
	return cs.Get(envName)
}

// Keys returns configured env var names.
func (cs *CredentialStore) Keys() []string {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	keys := make([]string, 0, len(cs.cache))
	for k := range cs.cache {
		keys = append(keys, k)
	}
	return keys
}
