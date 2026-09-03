package audit

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// UsageTotals aggregates token consumption across requests.
type UsageTotals struct {
	Requests            int `json:"requests"`
	InputTokens         int `json:"input_tokens"`
	OutputTokens        int `json:"output_tokens"`
	CacheReadTokens     int `json:"cache_read_tokens"`
	CacheCreationTokens int `json:"cache_creation_tokens"`
}

// add accumulates one request record into the totals.
func (u *UsageTotals) add(rec RequestRecord) {
	u.Requests++
	u.InputTokens += rec.InputTokens
	u.OutputTokens += rec.OutputTokens
	u.CacheReadTokens += rec.CacheReadInputTokens
	u.CacheCreationTokens += rec.CacheCreationInputTokens
}

// PromptTokens is the prompt volume after accounting for provider cache
// reporting: Anthropic lists cache exclusive of input_tokens, OpenAI
// includes it. Cache that exceeds input is treated as extra tokens.
func (u UsageTotals) PromptTokens() int {
	cache := u.CacheReadTokens + u.CacheCreationTokens
	if cache > u.InputTokens {
		return u.InputTokens + cache
	}
	return u.InputTokens
}

// TotalTokens returns prompt + output tokens (cache exclusive of input is
// included so Anthropic volume is not under-counted).
func (u UsageTotals) TotalTokens() int {
	return u.PromptTokens() + u.OutputTokens
}

// UsageDay aggregates usage for a single calendar day.
type UsageDay struct {
	Date string `json:"date"`
	UsageTotals
}

// UsageModelRow aggregates usage for a single model.
type UsageModelRow struct {
	Model string `json:"model"`
	UsageTotals
}

// UsageSessionRow aggregates usage for a single session.
type UsageSessionRow struct {
	SessionID string `json:"session_id"`
	Agent     string `json:"agent,omitempty"`
	UsageTotals
}

// UsageSummary is the aggregated token consumption report.
type UsageSummary struct {
	Total     UsageTotals       `json:"total"`
	Days      []UsageDay        `json:"days"`
	ByModel   []UsageModelRow   `json:"by_model"`
	BySession []UsageSessionRow `json:"by_session"`
}

// UsageQuery constrains a usage summary report.
type UsageQuery struct {
	// Days limits the report to records from the most recent N calendar
	// days (by record timestamp); 0 means all available records.
	Days int
	// UserID restricts the aggregation to one user; empty means all users.
	UserID string
}

// topSessions limits the per-session breakdown returned in a summary.
const topSessions = 20

// usageAgg collects the per-bucket maps while scanning request logs.
type usageAgg struct {
	total     UsageTotals
	byDate    map[string]*UsageTotals
	byModel   map[string]*UsageTotals
	bySession map[string]*UsageSessionRow
}

func newUsageAgg() *usageAgg {
	return &usageAgg{
		byDate:    map[string]*UsageTotals{},
		byModel:   map[string]*UsageTotals{},
		bySession: map[string]*UsageSessionRow{},
	}
}

// fold merges one request record into every bucket.
func (a *usageAgg) fold(rec RequestRecord) {
	a.total.add(rec)
	date := rec.Timestamp.Format("2006-01-02")
	a.totals(a.byDate, date).add(rec)
	if rec.Model != "" {
		a.totals(a.byModel, rec.Model).add(rec)
	}
	if rec.SessionID != "" {
		row := a.bySession[rec.SessionID]
		if row == nil {
			row = &UsageSessionRow{SessionID: rec.SessionID, Agent: rec.Agent}
			a.bySession[rec.SessionID] = row
		}
		row.add(rec)
	}
}

// totals returns (creating if needed) the bucket for key.
func (a *usageAgg) totals(m map[string]*UsageTotals, key string) *UsageTotals {
	t := m[key]
	if t == nil {
		t = &UsageTotals{}
		m[key] = t
	}
	return t
}

// UsageSummary aggregates token usage from the request logs, grouped by
// day, model, and session. Records with error set are included: tokens
// consumed by failed calls are still billed by most providers. Day buckets
// follow the record timestamp, so a file may span two buckets when the
// server runs past midnight.
func (l *RequestLogger) UsageSummary(query UsageQuery) (*UsageSummary, error) {
	names, err := usageFileNames(l.dir)
	if err != nil {
		return nil, err
	}
	cutoff := usageCutoff(query.Days)

	agg := newUsageAgg()
	for _, name := range names {
		f, err := os.Open(filepath.Join(l.dir, name))
		if err != nil {
			continue // file vanished mid-scan; skip
		}
		scanUsage(f, query.UserID, cutoff, agg.fold)
		_ = f.Close()
	}

	summary := &UsageSummary{
		Total:     agg.total,
		Days:      sortUsageDays(agg.byDate),
		ByModel:   sortUsageModels(agg.byModel),
		BySession: topUsageSessions(agg.bySession, topSessions),
	}
	if summary.Days == nil {
		summary.Days = []UsageDay{}
	}
	if summary.ByModel == nil {
		summary.ByModel = []UsageModelRow{}
	}
	if summary.BySession == nil {
		summary.BySession = []UsageSessionRow{}
	}
	return summary, nil
}

// scanUsage reads one request-log file, folding matching records into fold.
func scanUsage(f *os.File, userID string, cutoff time.Time, fold func(RequestRecord)) {
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var rec RequestRecord
		if err := json.Unmarshal(line, &rec); err != nil {
			continue
		}
		if userID != "" && rec.UserID != userID {
			continue
		}
		if !cutoff.IsZero() && rec.Timestamp.Before(cutoff) {
			continue
		}
		fold(rec)
	}
}

// usageCutoff returns the oldest allowed timestamp for a lookback window of
// days; zero means unlimited.
func usageCutoff(days int) time.Time {
	if days <= 0 {
		return time.Time{}
	}
	today := time.Now().Truncate(24 * time.Hour)
	return today.Add(-time.Duration(days-1) * 24 * time.Hour)
}

// usageFileNames returns the request-log file names, newest first.
func usageFileNames(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".jsonl" {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Sort(sort.Reverse(sort.StringSlice(names)))
	return names, nil
}

// sortUsageDays returns day aggregates oldest-first for chart rendering.
func sortUsageDays(byDate map[string]*UsageTotals) []UsageDay {
	days := make([]UsageDay, 0, len(byDate))
	for date, totals := range byDate {
		days = append(days, UsageDay{Date: date, UsageTotals: *totals})
	}
	sort.Slice(days, func(i, j int) bool { return days[i].Date < days[j].Date })
	return days
}

// sortUsageModels returns per-model aggregates sorted by total tokens desc.
func sortUsageModels(byModel map[string]*UsageTotals) []UsageModelRow {
	rows := make([]UsageModelRow, 0, len(byModel))
	for model, totals := range byModel {
		rows = append(rows, UsageModelRow{Model: model, UsageTotals: *totals})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].TotalTokens() != rows[j].TotalTokens() {
			return rows[i].TotalTokens() > rows[j].TotalTokens()
		}
		return rows[i].Model < rows[j].Model
	})
	return rows
}

// topUsageSessions returns per-session aggregates sorted by total tokens
// desc, capped at limit rows.
func topUsageSessions(bySession map[string]*UsageSessionRow, limit int) []UsageSessionRow {
	rows := make([]UsageSessionRow, 0, len(bySession))
	for _, row := range bySession {
		rows = append(rows, *row)
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].TotalTokens() != rows[j].TotalTokens() {
			return rows[i].TotalTokens() > rows[j].TotalTokens()
		}
		return rows[i].SessionID < rows[j].SessionID
	})
	if len(rows) > limit {
		rows = rows[:limit]
	}
	return rows
}
