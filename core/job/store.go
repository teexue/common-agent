package job

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// Store persists jobs and run records.
type Store interface {
	Save(j *Job) error
	Load(id string) (*Job, error)
	List() ([]*Job, error)
	Delete(id string) error
	SaveRun(rec *RunRecord) error
	ListRuns(jobID string, limit int) ([]*RunRecord, error)
}

// FileStore persists jobs as JSON files under dir/jobs/{id}.json
// and runs under dir/runs/{jobID}/{runID}.json.
type FileStore struct {
	dir string
	mu  sync.RWMutex
}

// NewFileStore creates a FileStore rooted at dir (typically ~/.common-agent/jobs).
func NewFileStore(dir string) (*FileStore, error) {
	if err := os.MkdirAll(filepath.Join(dir, "jobs"), 0o755); err != nil {
		return nil, fmt.Errorf("create jobs dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "runs"), 0o755); err != nil {
		return nil, fmt.Errorf("create runs dir: %w", err)
	}
	return &FileStore{dir: dir}, nil
}

func (fs *FileStore) jobPath(id string) string {
	safe := sanitizeID(id)
	return filepath.Join(fs.dir, "jobs", safe+".json")
}

func (fs *FileStore) runDir(jobID string) string {
	return filepath.Join(fs.dir, "runs", sanitizeID(jobID))
}

func sanitizeID(id string) string {
	return strings.NewReplacer("/", "_", "\\", "_", "..", "_", "\x00", "_").Replace(id)
}

// Save persists a job (upsert).
func (fs *FileStore) Save(j *Job) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	if j.ID == "" {
		return fmt.Errorf("job id is required")
	}
	j.UpdatedAt = time.Now().UTC()
	data, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal job: %w", err)
	}
	path := fs.jobPath(j.ID)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write job: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("rename job: %w", err)
	}
	return nil
}

// Load retrieves a job by id.
func (fs *FileStore) Load(id string) (*Job, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()
	data, err := os.ReadFile(fs.jobPath(id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("%w: %s", ErrNotFound, id)
		}
		return nil, err
	}
	var j Job
	if err := json.Unmarshal(data, &j); err != nil {
		return nil, fmt.Errorf("unmarshal job: %w", err)
	}
	return &j, nil
}

// List returns all jobs sorted by UpdatedAt descending.
func (fs *FileStore) List() ([]*Job, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()
	entries, err := os.ReadDir(filepath.Join(fs.dir, "jobs"))
	if err != nil {
		return nil, err
	}
	var out []*Job
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(fs.dir, "jobs", e.Name()))
		if err != nil {
			continue
		}
		var j Job
		if err := json.Unmarshal(data, &j); err != nil {
			continue
		}
		out = append(out, &j)
	}
	sort.Slice(out, func(i, k int) bool {
		return out[i].UpdatedAt.After(out[k].UpdatedAt)
	})
	return out, nil
}

// Delete removes a job and its run history.
func (fs *FileStore) Delete(id string) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	path := fs.jobPath(id)
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("%w: %s", ErrNotFound, id)
		}
		return err
	}
	_ = os.RemoveAll(fs.runDir(id))
	return nil
}

// SaveRun persists a run record.
func (fs *FileStore) SaveRun(rec *RunRecord) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	if rec.JobID == "" || rec.ID == "" {
		return fmt.Errorf("job_id and id are required")
	}
	dir := fs.runDir(rec.JobID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(rec, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(dir, sanitizeID(rec.ID)+".json")
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ListRuns returns recent runs for a job (newest first).
func (fs *FileStore) ListRuns(jobID string, limit int) ([]*RunRecord, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()
	dir := fs.runDir(jobID)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []*RunRecord{}, nil
		}
		return nil, err
	}
	var out []*RunRecord
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var r RunRecord
		if err := json.Unmarshal(data, &r); err != nil {
			continue
		}
		out = append(out, &r)
	}
	sort.Slice(out, func(i, k int) bool {
		return out[i].StartedAt.After(out[k].StartedAt)
	})
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
