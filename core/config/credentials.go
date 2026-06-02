package config

import (
	"fmt"
	"os"
	"sync"

	"gopkg.in/yaml.v3"
)

// CredentialStore is a thread-safe store for API credentials backed by a YAML file.
type CredentialStore struct {
	mu    sync.RWMutex
	cache map[string]string
	home  string
}

// NewCredentialStore creates a store and loads existing credentials from home.
func NewCredentialStore(home string) (*CredentialStore, error) {
	cs := &CredentialStore{home: home}
	if err := cs.load(); err != nil {
		return nil, err
	}
	return cs, nil
}

func (cs *CredentialStore) load() error {
	path := CredentialsFile(cs.home)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			cs.cache = map[string]string{}
			return nil
		}
		return fmt.Errorf("read credentials: %w", err)
	}
	var creds map[string]string
	if err := yaml.Unmarshal(data, &creds); err != nil {
		return fmt.Errorf("parse credentials: %w", err)
	}
	cs.cache = creds
	return nil
}

// Set stores a credential key-value pair and persists to disk.
func (cs *CredentialStore) Set(envName, value string) error {
	if envName == "" {
		return fmt.Errorf("env name is required")
	}
	if value == "" {
		return fmt.Errorf("value is required")
	}

	cs.mu.Lock()
	defer cs.mu.Unlock()
	if cs.cache == nil {
		cs.cache = map[string]string{}
	}
	cs.cache[envName] = value
	return cs.writeLocked()
}

// Get returns a stored credential by env var name.
func (cs *CredentialStore) Get(envName string) string {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	if cs.cache == nil {
		return ""
	}
	return cs.cache[envName]
}

// Lookup returns the credential for envName, first checking the environment
// variable, then falling back to the store. This matches the signature
// expected by provider.LoadCatalog.
func (cs *CredentialStore) Lookup(envName string) string {
	if v := os.Getenv(envName); v != "" {
		return v
	}
	return cs.Get(envName)
}

// Keys returns configured env var names (values redacted).
func (cs *CredentialStore) Keys() []string {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	keys := make([]string, 0, len(cs.cache))
	for k := range cs.cache {
		keys = append(keys, k)
	}
	return keys
}

func (cs *CredentialStore) writeLocked() error {
	if err := ensureHome(cs.home); err != nil {
		return err
	}
	data, err := yaml.Marshal(cs.cache)
	if err != nil {
		return fmt.Errorf("marshal credentials: %w", err)
	}
	path := CredentialsFile(cs.home)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write credentials: %w", err)
	}
	return nil
}

// --- Legacy package-level API (deprecated, kept for compatibility) ---

var (
	legacyStore *CredentialStore
	legacyMu    sync.Mutex
)

func initLegacy() error {
	legacyMu.Lock()
	defer legacyMu.Unlock()
	if legacyStore != nil {
		return nil
	}
	home, err := Home(false)
	if err != nil {
		return err
	}
	cs, err := NewCredentialStore(home)
	if err != nil {
		// If the home doesn't exist yet, create an in-memory-only store.
		cs = &CredentialStore{home: home, cache: map[string]string{}}
	}
	legacyStore = cs
	return nil
}

// LoadCredentials reads credentials.yaml from home into memory.
// Deprecated: use NewCredentialStore instead.
func LoadCredentials(home string) error {
	cs, err := NewCredentialStore(home)
	if err != nil {
		return err
	}
	legacyMu.Lock()
	defer legacyMu.Unlock()
	legacyStore = cs
	return nil
}

// SetCredential stores a key in credentials.yaml.
// Deprecated: use CredentialStore.Set instead.
func SetCredential(home, envName, value string) error {
	cs, err := NewCredentialStore(home)
	if err != nil {
		return err
	}
	return cs.Set(envName, value)
}

// GetCredential returns a stored credential by env var name.
// Deprecated: use CredentialStore.Get instead.
func GetCredential(envName string) string {
	if legacyStore == nil {
		_ = initLegacy()
	}
	if legacyStore == nil {
		return ""
	}
	return legacyStore.Get(envName)
}

// ListCredentialKeys returns configured env var names.
// Deprecated: use CredentialStore.Keys instead.
func ListCredentialKeys(home string) ([]string, error) {
	cs, err := NewCredentialStore(home)
	if err != nil {
		return nil, err
	}
	return cs.Keys(), nil
}
