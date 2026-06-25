package billing

import (
	"testing"
	"time"
)

func TestTracker_Record(t *testing.T) {
	dir := t.TempDir()
	tracker := NewTracker(dir)

	rec := UsageRecord{
		TenantID:     "t1",
		SessionID:    "s1",
		Agent:        "test",
		InputTokens:  100,
		OutputTokens: 50,
		Turns:        2,
		Timestamp:    time.Now(),
	}

	if err := tracker.Record(rec); err != nil {
		t.Fatal(err)
	}
}

func TestTracker_DailyUsage(t *testing.T) {
	dir := t.TempDir()
	tracker := NewTracker(dir)

	now := time.Now()
	date := now.Format("2006-01-02")

	records := []UsageRecord{
		{TenantID: "t1", SessionID: "s1", InputTokens: 100, OutputTokens: 50, Timestamp: now},
		{TenantID: "t1", SessionID: "s2", InputTokens: 200, OutputTokens: 100, Timestamp: now},
		{TenantID: "t2", SessionID: "s3", InputTokens: 50, OutputTokens: 25, Timestamp: now},
	}

	for _, r := range records {
		tracker.Record(r)
	}

	usage, err := tracker.DailyUsage("t1", date)
	if err != nil {
		t.Fatal(err)
	}

	if usage.Runs != 2 {
		t.Errorf("expected 2 runs, got %d", usage.Runs)
	}
	if usage.TotalInput != 300 {
		t.Errorf("expected 300 input tokens, got %d", usage.TotalInput)
	}
	if usage.TotalOutput != 150 {
		t.Errorf("expected 150 output tokens, got %d", usage.TotalOutput)
	}
	if usage.TotalTokens != 450 {
		t.Errorf("expected 450 total tokens, got %d", usage.TotalTokens)
	}
}

func TestTracker_DailyUsage_Empty(t *testing.T) {
	dir := t.TempDir()
	tracker := NewTracker(dir)

	usage, err := tracker.DailyUsage("t1", "2026-01-01")
	if err != nil {
		t.Fatal(err)
	}
	if usage.Runs != 0 {
		t.Errorf("expected 0 runs, got %d", usage.Runs)
	}
}

func TestTracker_CheckQuota_Unlimited(t *testing.T) {
	dir := t.TempDir()
	tracker := NewTracker(dir)

	ok, err := tracker.CheckQuota("t1", 0)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Error("expected unlimited quota to pass")
	}
}

func TestTracker_CheckQuota_WithinLimit(t *testing.T) {
	dir := t.TempDir()
	tracker := NewTracker(dir)

	tracker.Record(UsageRecord{TenantID: "t1", Timestamp: time.Now()})

	ok, err := tracker.CheckQuota("t1", 10)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Error("expected within quota")
	}
}

func TestTracker_CheckQuota_Exceeded(t *testing.T) {
	dir := t.TempDir()
	tracker := NewTracker(dir)

	for i := 0; i < 5; i++ {
		tracker.Record(UsageRecord{TenantID: "t1", Timestamp: time.Now()})
	}

	ok, err := tracker.CheckQuota("t1", 5)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Error("expected quota exceeded")
	}
}

func TestTracker_CheckTokenQuota(t *testing.T) {
	dir := t.TempDir()
	tracker := NewTracker(dir)

	tracker.Record(UsageRecord{TenantID: "t1", InputTokens: 100, OutputTokens: 50, Timestamp: time.Now()})

	ok, err := tracker.CheckTokenQuota("t1", 200)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Error("expected within token quota")
	}

	ok, err = tracker.CheckTokenQuota("t1", 100)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Error("expected token quota exceeded")
	}
}

func TestTracker_PathTraversal(t *testing.T) {
	dir := t.TempDir()
	tracker := NewTracker(dir)

	maliciousIDs := []string{
		"../../etc/passwd",
		"../tmp",
		"a/b/c",
		"test@evil",
	}

	for _, id := range maliciousIDs {
		t.Run("Record_"+id, func(t *testing.T) {
			err := tracker.Record(UsageRecord{TenantID: id, Timestamp: time.Now()})
			if err == nil {
				t.Fatalf("expected error for malicious ID %q", id)
			}
		})
		t.Run("DailyUsage_"+id, func(t *testing.T) {
			_, err := tracker.DailyUsage(id, "2026-01-01")
			if err == nil {
				t.Fatalf("expected error for malicious ID %q", id)
			}
		})
	}
}

func TestTracker_ValidIDs(t *testing.T) {
	dir := t.TempDir()
	tracker := NewTracker(dir)

	validIDs := []string{
		"t1", "tenant-a", "tenant_b", "ABC123",
	}

	for _, id := range validIDs {
		t.Run(id, func(t *testing.T) {
			err := tracker.Record(UsageRecord{TenantID: id, Timestamp: time.Now()})
			if err != nil {
				t.Fatalf("expected success for valid ID %q, got: %v", id, err)
			}
		})
	}
}
