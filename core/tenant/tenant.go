// Package tenant provides multi-tenant support with quota management.
package tenant

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"
)

// Tenant represents a tenant with quotas and rate limits.
type Tenant struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	DailyQuota  int       `json:"daily_quota"`  // max runs per day (0 = unlimited)
	DailyTokens int       `json:"daily_tokens"` // max tokens per day (0 = unlimited)
	RateLimit   int       `json:"rate_limit"`   // max requests per minute (0 = unlimited)
	CreatedAt   time.Time `json:"created_at"`
}

// Store is the persistence interface for tenants.
type Store interface {
	Get(id string) (*Tenant, error)
	List() ([]*Tenant, error)
	Save(t *Tenant) error
	Delete(id string) error
}

// FileStore persists tenants as JSON files.
type FileStore struct {
	dir string
	mu  sync.RWMutex
}

// NewFileStore creates a FileStore.
func NewFileStore(dir string) (*FileStore, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create tenants dir: %w", err)
	}
	return &FileStore{dir: dir}, nil
}

// validIDPattern restricts tenant IDs to safe characters to prevent path traversal.
var validIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// validateID ensures the tenant ID contains only safe characters.
func validateID(id string) error {
	if id == "" {
		return fmt.Errorf("tenant ID is required")
	}
	if !validIDPattern.MatchString(id) {
		return fmt.Errorf("tenant ID %q contains invalid characters; only alphanumeric, hyphen and underscore are allowed", id)
	}
	return nil
}

func (s *FileStore) path(id string) string {
	return filepath.Join(s.dir, id+".json")
}

// Get returns a tenant by ID.
func (s *FileStore) Get(id string) (*Tenant, error) {
	if err := validateID(id); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.path(id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("tenant %q not found", id)
		}
		return nil, err
	}

	var t Tenant
	if err := json.Unmarshal(data, &t); err != nil {
		return nil, fmt.Errorf("parse tenant: %w", err)
	}
	return &t, nil
}

// List returns all tenants.
func (s *FileStore) List() ([]*Tenant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}

	var tenants []*Tenant
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.dir, e.Name()))
		if err != nil {
			continue
		}
		var t Tenant
		if err := json.Unmarshal(data, &t); err != nil {
			continue
		}
		tenants = append(tenants, &t)
	}
	return tenants, nil
}

// Save creates or updates a tenant.
func (s *FileStore) Save(t *Tenant) error {
	if err := validateID(t.ID); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now()
	}

	data, err := json.MarshalIndent(t, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path(t.ID), data, 0o644)
}

// Delete removes a tenant.
func (s *FileStore) Delete(id string) error {
	if err := validateID(id); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	path := s.path(id)
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("tenant %q not found", id)
		}
		return err
	}
	return nil
}
