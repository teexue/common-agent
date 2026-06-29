package session

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/teexue/common-agent/core/provider"
)

// FileStore persists sessions as JSON files in a directory.
// It is safe for concurrent use.
type FileStore struct {
	dir string
	mu  sync.RWMutex
}

// NewFileStore creates a FileStore that writes to the given directory.
// The directory is created if it does not exist.
func NewFileStore(dir string) (*FileStore, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create session dir: %w", err)
	}
	return &FileStore{dir: dir}, nil
}

// sessionFile is the on-disk JSON representation.
type sessionFile struct {
	ID        string            `json:"id"`
	Agent     string            `json:"agent"`
	Messages  []json.RawMessage `json:"messages"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	CreatedAt string            `json:"created_at"`
	UpdatedAt string            `json:"updated_at"`
}

// Save persists a session to disk atomically (temp + rename).
func (fs *FileStore) Save(sess *Session) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	sess.mu.RLock()
	sf := sessionFile{
		ID:        sess.ID,
		Agent:     sess.Agent,
		Metadata:  sess.Metadata,
		CreatedAt: sess.CreatedAt.Format("2006-01-02T15:04:05.000Z07:00"),
		UpdatedAt: sess.UpdatedAt.Format("2006-01-02T15:04:05.000Z07:00"),
	}
	// Marshal messages individually to preserve their JSON structure.
	sf.Messages = make([]json.RawMessage, len(sess.Messages))
	for i, m := range sess.Messages {
		b, err := json.Marshal(m)
		if err != nil {
			sess.mu.RUnlock()
			return fmt.Errorf("marshal message %d: %w", i, err)
		}
		sf.Messages[i] = b
	}
	sess.mu.RUnlock()

	data, err := json.MarshalIndent(sf, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}

	path := fs.filePath(sess.ID)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("rename temp file: %w", err)
	}
	return nil
}

// Load retrieves a session by ID. Returns ErrNotFound if not found.
func (fs *FileStore) Load(id string) (*Session, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	path := fs.filePath(id)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("%w: %s", ErrNotFound, id)
		}
		return nil, err
	}

	var sf sessionFile
	if err := json.Unmarshal(data, &sf); err != nil {
		return nil, fmt.Errorf("corrupted session file %s: %w", id, err)
	}

	createdAt, err := parseTime(sf.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("parse created_at: %w", err)
	}
	updatedAt, err := parseTime(sf.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("parse updated_at: %w", err)
	}

	msgs := make([]provider.Message, len(sf.Messages))
	for i, raw := range sf.Messages {
		if err := json.Unmarshal(raw, &msgs[i]); err != nil {
			return nil, fmt.Errorf("corrupted message %d in session %s: %w", i, id, err)
		}
	}

	return &Session{
		ID:        sf.ID,
		Agent:     sf.Agent,
		Messages:  msgs,
		Metadata:  sf.Metadata,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}, nil
}

// List returns metadata for all stored sessions, ordered by UpdatedAt descending.
func (fs *FileStore) List() ([]SessionMeta, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	entries, err := os.ReadDir(fs.dir)
	if err != nil {
		return nil, fmt.Errorf("read session dir: %w", err)
	}

	var metas []SessionMeta
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(fs.dir, entry.Name()))
		if err != nil {
			continue // skip unreadable files
		}
		var sf sessionFile
		if err := json.Unmarshal(data, &sf); err != nil {
			continue // skip corrupted files
		}
		createdAt, err := parseTime(sf.CreatedAt)
		if err != nil {
			continue
		}
		updatedAt, err := parseTime(sf.UpdatedAt)
		if err != nil {
			continue
		}
		metas = append(metas, SessionMeta{
			ID:        sf.ID,
			Agent:     sf.Agent,
			Metadata:  sf.Metadata,
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
		})
	}

	sort.Slice(metas, func(i, j int) bool {
		return metas[i].UpdatedAt.After(metas[j].UpdatedAt)
	})

	return metas, nil
}

// Delete removes a session file. Returns ErrNotFound if not found.
func (fs *FileStore) Delete(id string) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	path := fs.filePath(id)
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("%w: %s", ErrNotFound, id)
		}
		return err
	}
	return nil
}

func (fs *FileStore) filePath(id string) string {
	// Sanitize ID to prevent path traversal.
	safe := strings.NewReplacer("/", "_", "\\", "_", "..", "_", "\x00", "_").Replace(id)
	cleaned := filepath.Clean(filepath.Join(fs.dir, safe+".json"))
	// Defense in depth: ensure the cleaned path is still within dir.
	if !strings.HasPrefix(cleaned, filepath.Clean(fs.dir)+string(filepath.Separator)) {
		return filepath.Join(fs.dir, "_invalid_.json")
	}
	return cleaned
}

func parseTime(s string) (time.Time, error) {
	layouts := []string{
		"2006-01-02T15:04:05.000Z07:00",
		"2006-01-02T15:04:05Z07:00",
		time.RFC3339Nano,
		time.RFC3339,
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse time: %q", s)
}
