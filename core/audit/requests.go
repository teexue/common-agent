package audit

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// requestRecordMaxBytes caps a single persisted request record; larger
// payloads are truncated by the caller before logging.
const requestRecordMaxBytes = 128 * 1024

// RequestRecord captures one LLM request/response pair for audit and
// troubleshooting purposes.
type RequestRecord struct {
	Timestamp    time.Time       `json:"ts"`
	SessionID    string          `json:"session_id,omitempty"`
	Agent        string          `json:"agent,omitempty"`
	Source       string          `json:"source,omitempty"` // chat | http | kanban | cli | optimize
	Model        string          `json:"model,omitempty"`
	DurationMs   int64           `json:"duration_ms"`
	Request      json.RawMessage `json:"request,omitempty"`
	Response     json.RawMessage `json:"response,omitempty"`
	Error        string          `json:"error,omitempty"`
	InputTokens  int             `json:"input_tokens,omitempty"`
	OutputTokens int             `json:"output_tokens,omitempty"`
}

// RequestLogger persists LLM request records as per-day NDJSON files.
type RequestLogger struct {
	dir string
	mu  sync.Mutex
}

// NewRequestLogger creates a RequestLogger writing daily files under dir.
func NewRequestLogger(dir string) *RequestLogger {
	return &RequestLogger{dir: dir}
}

// Log appends a request record to today's file. Oversized records are
// dropped with an error rather than written partially.
func (l *RequestLogger) Log(rec RequestRecord) error {
	data, err := json.Marshal(rec)
	if err != nil {
		return fmt.Errorf("marshal request record: %w", err)
	}
	if len(data) > requestRecordMaxBytes {
		return fmt.Errorf("request record too large: %d bytes", len(data))
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	if err := os.MkdirAll(l.dir, 0o755); err != nil {
		return fmt.Errorf("create request log dir: %w", err)
	}
	path := filepath.Join(l.dir, time.Now().Format("2006-01-02")+".jsonl")
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open request log: %w", err)
	}
	defer f.Close()
	if _, err := f.Write(append(data, '\n')); err != nil {
		return fmt.Errorf("write request record: %w", err)
	}
	return nil
}

// RequestFilter constrains request log queries.
type RequestFilter struct {
	SessionID string
	Source    string
	Limit     int
}

// Query returns recent request records, newest first, reading daily files
// backwards until the limit is reached.
func (l *RequestLogger) Query(filter RequestFilter) ([]RequestRecord, error) {
	entries, err := os.ReadDir(l.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read request log dir: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".jsonl" {
			names = append(names, e.Name())
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(names)))

	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	var out []RequestRecord
	for _, name := range names {
		if len(out) >= limit {
			break
		}
		recs, err := readRequestFile(filepath.Join(l.dir, name), filter)
		if err != nil {
			return nil, err
		}
		out = append(out, recs...)
	}
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

// readRequestFile reads one daily file and returns matching records, newest
// first within the file.
func readRequestFile(path string, filter RequestFilter) ([]RequestRecord, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open request log: %w", err)
	}
	defer f.Close()

	var recs []RequestRecord
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 256*1024), 256*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var rec RequestRecord
		if err := json.Unmarshal(line, &rec); err != nil {
			continue
		}
		if filter.SessionID != "" && rec.SessionID != filter.SessionID {
			continue
		}
		if filter.Source != "" && rec.Source != filter.Source {
			continue
		}
		recs = append(recs, rec)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read request log: %w", err)
	}
	for i, j := 0, len(recs)-1; i < j; i, j = i+1, j-1 {
		recs[i], recs[j] = recs[j], recs[i]
	}
	return recs, nil
}
