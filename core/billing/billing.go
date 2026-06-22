// Package billing provides usage tracking and quota enforcement.
package billing

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// UsageRecord tracks token usage for a single run.
type UsageRecord struct {
	TenantID    string    `json:"tenant_id"`
	SessionID   string    `json:"session_id"`
	Agent       string    `json:"agent"`
	InputTokens int       `json:"input_tokens"`
	OutputTokens int      `json:"output_tokens"`
	Turns       int       `json:"turns"`
	Timestamp   time.Time `json:"ts"`
}

// DailyUsage aggregates usage for a tenant on a given day.
type DailyUsage struct {
	Date          string `json:"date"`
	Runs          int    `json:"runs"`
	TotalInput    int    `json:"total_input_tokens"`
	TotalOutput   int    `json:"total_output_tokens"`
	TotalTokens   int    `json:"total_tokens"`
}

// Tracker tracks and persists usage records.
type Tracker struct {
	dir string
	mu  sync.Mutex
}

// NewTracker creates a Tracker.
func NewTracker(dir string) *Tracker {
	return &Tracker{dir: dir}
}

// Record persists a usage record.
func (t *Tracker) Record(rec UsageRecord) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if err := os.MkdirAll(t.dir, 0o755); err != nil {
		return fmt.Errorf("create billing dir: %w", err)
	}

	// Append to daily file.
	date := rec.Timestamp.Format("2006-01-02")
	path := filepath.Join(t.dir, rec.TenantID+"-"+date+".jsonl")

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open usage file: %w", err)
	}
	defer f.Close()

	data, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	_, err = f.Write(data)
	return err
}

// DailyUsage returns aggregated usage for a tenant on a given date.
func (t *Tracker) DailyUsage(tenantID, date string) (*DailyUsage, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	path := filepath.Join(t.dir, tenantID+"-"+date+".jsonl")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &DailyUsage{Date: date}, nil
		}
		return nil, err
	}

	usage := &DailyUsage{Date: date}
	start := 0
	for start < len(data) {
		end := start
		for end < len(data) && data[end] != '\n' {
			end++
		}
		line := data[start:end]
		start = end + 1

		if len(line) == 0 {
			continue
		}

		var rec UsageRecord
		if err := json.Unmarshal(line, &rec); err != nil {
			continue
		}

		usage.Runs++
		usage.TotalInput += rec.InputTokens
		usage.TotalOutput += rec.OutputTokens
		usage.TotalTokens += rec.InputTokens + rec.OutputTokens
	}

	return usage, nil
}

// CheckQuota returns true if the tenant is within their daily quota.
func (t *Tracker) CheckQuota(tenantID string, dailyQuota int) (bool, error) {
	if dailyQuota <= 0 {
		return true, nil // unlimited
	}

	date := time.Now().Format("2006-01-02")
	usage, err := t.DailyUsage(tenantID, date)
	if err != nil {
		return false, err
	}
	return usage.Runs < dailyQuota, nil
}

// CheckTokenQuota returns true if the tenant is within their daily token quota.
func (t *Tracker) CheckTokenQuota(tenantID string, dailyTokens int) (bool, error) {
	if dailyTokens <= 0 {
		return true, nil // unlimited
	}

	date := time.Now().Format("2006-01-02")
	usage, err := t.DailyUsage(tenantID, date)
	if err != nil {
		return false, err
	}
	return usage.TotalTokens < dailyTokens, nil
}
