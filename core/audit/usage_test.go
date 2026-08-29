package audit

import (
	"encoding/json"
	"testing"
	"time"
)

func TestUsageSummary(t *testing.T) {
	l := NewRequestLogger(t.TempDir())
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)

	recs := []RequestRecord{
		{Timestamp: now, SessionID: "s1", UserID: "u1", Agent: "demo", Model: "m1", InputTokens: 100, OutputTokens: 50},
		{Timestamp: now, SessionID: "s1", UserID: "u1", Agent: "demo", Model: "m1", InputTokens: 200, OutputTokens: 80, CacheReadInputTokens: 150},
		{Timestamp: now, SessionID: "s2", UserID: "u2", Model: "m2", InputTokens: 10, OutputTokens: 5, Error: "boom"},
		{Timestamp: yesterday, SessionID: "s1", UserID: "u1", Model: "m2", InputTokens: 40, OutputTokens: 20},
		{Timestamp: yesterday, SessionID: "", Model: "m3", InputTokens: 7, OutputTokens: 3}, // no session: totals only
	}
	for _, r := range recs {
		if err := l.Log(r); err != nil {
			t.Fatalf("Log: %v", err)
		}
	}

	// All users.
	summary, err := l.UsageSummary(UsageQuery{})
	if err != nil {
		t.Fatalf("UsageSummary: %v", err)
	}
	if summary.Total.Requests != 5 {
		t.Errorf("requests = %d, want 5", summary.Total.Requests)
	}
	if got := summary.Total.InputTokens; got != 100+200+10+40+7 {
		t.Errorf("input = %d, want %d", got, 100+200+10+40+7)
	}
	if got := summary.Total.OutputTokens; got != 50+80+5+20+3 {
		t.Errorf("output = %d, want %d", got, 50+80+5+20+3)
	}
	if summary.Total.CacheReadTokens != 150 {
		t.Errorf("cache read = %d, want 150", summary.Total.CacheReadTokens)
	}
}

func TestUsageSummaryBreakdown(t *testing.T) {
	l := NewRequestLogger(t.TempDir())
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)
	recs := []RequestRecord{
		{Timestamp: now, SessionID: "s1", UserID: "u1", Agent: "demo", Model: "m1", InputTokens: 100, OutputTokens: 50},
		{Timestamp: now, SessionID: "s1", UserID: "u1", Agent: "demo", Model: "m1", InputTokens: 200, OutputTokens: 80, CacheReadInputTokens: 150},
		{Timestamp: now, SessionID: "s2", UserID: "u2", Model: "m2", InputTokens: 10, OutputTokens: 5, Error: "boom"},
		{Timestamp: yesterday, SessionID: "s1", UserID: "u1", Model: "m2", InputTokens: 40, OutputTokens: 20},
		{Timestamp: yesterday, SessionID: "", Model: "m3", InputTokens: 7, OutputTokens: 3},
	}
	for _, r := range recs {
		if err := l.Log(r); err != nil {
			t.Fatalf("Log: %v", err)
		}
	}
	summary, err := l.UsageSummary(UsageQuery{})
	if err != nil {
		t.Fatalf("UsageSummary: %v", err)
	}
	if len(summary.Days) != 2 {
		t.Fatalf("days = %d, want 2", len(summary.Days))
	}
	// Oldest first.
	if summary.Days[0].Date != yesterday.Format("2006-01-02") {
		t.Errorf("first day = %s, want %s", summary.Days[0].Date, yesterday.Format("2006-01-02"))
	}
	if len(summary.ByModel) != 3 {
		t.Fatalf("models = %d, want 3", len(summary.ByModel))
	}
	// Sorted by total tokens desc: m1 (430) > m2 (75) > m3 (10).
	if summary.ByModel[0].Model != "m1" || summary.ByModel[1].Model != "m2" || summary.ByModel[2].Model != "m3" {
		t.Errorf("model order = %s,%s,%s", summary.ByModel[0].Model, summary.ByModel[1].Model, summary.ByModel[2].Model)
	}
	if len(summary.BySession) != 2 {
		t.Fatalf("sessions = %d, want 2", len(summary.BySession))
	}
	// s1 (490) > s2 (15); the sessionless record is excluded by design.
	if summary.BySession[0].SessionID != "s1" || summary.BySession[0].Agent != "demo" {
		t.Errorf("top session = %+v", summary.BySession[0])
	}
}

func TestUsageSummary_UserFilter(t *testing.T) {
	l := NewRequestLogger(t.TempDir())
	now := time.Now()
	recs := []RequestRecord{
		{Timestamp: now, SessionID: "s1", UserID: "u1", Model: "m1", InputTokens: 100, OutputTokens: 10},
		{Timestamp: now, SessionID: "s2", UserID: "u2", Model: "m1", InputTokens: 500, OutputTokens: 50},
	}
	for _, r := range recs {
		if err := l.Log(r); err != nil {
			t.Fatalf("Log: %v", err)
		}
	}
	summary, err := l.UsageSummary(UsageQuery{UserID: "u1"})
	if err != nil {
		t.Fatalf("UsageSummary: %v", err)
	}
	if summary.Total.InputTokens != 100 {
		t.Errorf("input = %d, want 100", summary.Total.InputTokens)
	}
	if len(summary.BySession) != 1 || summary.BySession[0].SessionID != "s1" {
		t.Errorf("sessions = %+v", summary.BySession)
	}
}

func TestUsageSummary_DaysWindow(t *testing.T) {
	l := NewRequestLogger(t.TempDir())
	now := time.Now()
	for i := 0; i < 5; i++ {
		ts := now.Add(-time.Duration(i) * 24 * time.Hour)
		if err := l.Log(RequestRecord{Timestamp: ts, SessionID: "s1", Model: "m", InputTokens: 10}); err != nil {
			t.Fatalf("Log: %v", err)
		}
	}
	summary, err := l.UsageSummary(UsageQuery{Days: 2})
	if err != nil {
		t.Fatalf("UsageSummary: %v", err)
	}
	if summary.Total.Requests != 2 {
		t.Errorf("requests = %d, want 2", summary.Total.Requests)
	}
	if len(summary.Days) != 2 {
		t.Errorf("days = %d, want 2", len(summary.Days))
	}
}

func TestUsageSummary_EmptyDir(t *testing.T) {
	l := NewRequestLogger(t.TempDir())
	summary, err := l.UsageSummary(UsageQuery{})
	if err != nil {
		t.Fatalf("UsageSummary: %v", err)
	}
	if summary.Total.Requests != 0 || len(summary.Days) != 0 {
		t.Errorf("unexpected summary: %+v", summary)
	}
}

func TestUsageSummary_TotalsJSON(t *testing.T) {
	totals := UsageTotals{Requests: 2, InputTokens: 30, OutputTokens: 5}
	data, err := json.Marshal(totals)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if string(data) != `{"requests":2,"input_tokens":30,"output_tokens":5,"cache_read_tokens":0,"cache_creation_tokens":0}` {
		t.Errorf("json = %s", data)
	}
	if totals.TotalTokens() != 35 {
		t.Errorf("TotalTokens = %d, want 35", totals.TotalTokens())
	}
}
