package agent

import "testing"

func TestValidate_KeepHead(t *testing.T) {
	a := &Agent{
		Name:         "x",
		Provider:     "p",
		Model:        "m",
		SystemPrompt: "sys",
		Tools:        []string{"echo"},
		Compaction: &CompactionConfig{
			Strategy:   "truncation",
			KeepRecent: 20,
			KeepHead:   -1,
		},
	}
	if err := a.validate(); err == nil {
		t.Fatal("expected error for negative keep_head")
	}
	a.Compaction.KeepHead = 0
	if err := a.validate(); err != nil {
		t.Fatalf("keep_head 0 should be valid: %v", err)
	}
	a.Compaction.KeepHead = 4
	if err := a.validate(); err != nil {
		t.Fatalf("keep_head 4 should be valid: %v", err)
	}
}

func TestValidate_SummaryModel(t *testing.T) {
	a := &Agent{
		Name:         "x",
		Provider:     "p",
		Model:        "m",
		SystemPrompt: "sys",
		Tools:        []string{"echo"},
		Compaction: &CompactionConfig{
			Strategy:     "summarize",
			KeepRecent:   20,
			SummaryModel: "cheap-model",
		},
	}
	if err := a.validate(); err != nil {
		t.Fatalf("summary_model should be accepted: %v", err)
	}
}
