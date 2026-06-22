package compaction

import (
	"testing"

	"github.com/teexue/common-agent/core/provider"
)

func makeMessages(count int) []provider.Message {
	msgs := make([]provider.Message, 0, count+1)
	msgs = append(msgs, provider.Message{Role: provider.RoleSystem, Content: "You are helpful."})
	for i := 0; i < count; i++ {
		role := provider.RoleUser
		if i%2 == 1 {
			role = provider.RoleAssistant
		}
		msgs = append(msgs, provider.Message{Role: role, Content: "message " + itoa(i)})
	}
	return msgs
}

func TestNeedsCompaction(t *testing.T) {
	tests := []struct {
		name        string
		count       int // number of user/assistant messages (system message is added automatically)
		maxMessages int
		want        bool
	}{
		{"below threshold", 5, 10, false},   // 6 total < 10
		{"at threshold", 9, 10, false},      // 10 total = 10
		{"above threshold", 10, 10, true},   // 11 total > 10
		{"disabled", 100, 0, false},
		{"negative max", 100, -1, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msgs := makeMessages(tt.count)
			if got := NeedsCompaction(msgs, tt.maxMessages); got != tt.want {
				t.Errorf("NeedsCompaction(%d msgs, max %d) = %v, want %v", len(msgs), tt.maxMessages, got, tt.want)
			}
		})
	}
}

func TestTruncationCompactor_NoCompactionNeeded(t *testing.T) {
	c := NewTruncationCompactor(100, 10)
	msgs := makeMessages(5)

	result, err := c.Compact(msgs)
	if err != nil {
		t.Fatal(err)
	}
	if result != nil {
		t.Error("expected nil when no compaction needed")
	}
}

func TestTruncationCompactor_Compacts(t *testing.T) {
	c := NewTruncationCompactor(10, 5)
	msgs := makeMessages(20) // system + 20 messages = 21 total

	result, err := c.Compact(msgs)
	if err != nil {
		t.Fatal(err)
	}
	if result == nil {
		t.Fatal("expected compaction result")
	}

	if result.OldCount != 21 {
		t.Errorf("expected OldCount 21, got %d", result.OldCount)
	}
	if result.NewCount >= 21 {
		t.Errorf("expected fewer messages, got %d", result.NewCount)
	}

	// Verify system message is preserved.
	foundSystem := false
	for _, m := range result.Compacted {
		if m.Role == provider.RoleSystem {
			foundSystem = true
		}
	}
	if !foundSystem {
		t.Error("system message not preserved")
	}

	// Verify recent messages are preserved.
	if len(result.Compacted) < 5 {
		t.Errorf("expected at least 5 messages (system + summary + recent), got %d", len(result.Compacted))
	}

	// Verify summary message exists.
	if result.Summary == "" {
		t.Error("expected non-empty summary")
	}
}

func TestTruncationCompactor_PreservesToolPairs(t *testing.T) {
	c := NewTruncationCompactor(6, 4)

	msgs := []provider.Message{
		{Role: provider.RoleSystem, Content: "system"},
		{Role: provider.RoleUser, Content: "q1"},
		{Role: provider.RoleAssistant, Content: "", ToolCalls: []provider.ToolCall{{ID: "tc1", Name: "echo"}}},
		{Role: provider.RoleTool, ToolCallID: "tc1", Content: "result1"},
		{Role: provider.RoleUser, Content: "q2"},
		{Role: provider.RoleAssistant, Content: "", ToolCalls: []provider.ToolCall{{ID: "tc2", Name: "echo"}}},
		{Role: provider.RoleTool, ToolCallID: "tc2", Content: "result2"},
	}

	result, err := c.Compact(msgs)
	if err != nil {
		t.Fatal(err)
	}
	if result == nil {
		t.Fatal("expected compaction")
	}

	// Verify tool pairs are intact: for each tool result, there should be a matching assistant call.
	toolCallIDs := make(map[string]bool)
	for _, m := range result.Compacted {
		if m.Role == provider.RoleAssistant {
			for _, tc := range m.ToolCalls {
				toolCallIDs[tc.ID] = true
			}
		}
	}
	for _, m := range result.Compacted {
		if m.Role == provider.RoleTool && m.ToolCallID != "" {
			if !toolCallIDs[m.ToolCallID] {
				t.Errorf("orphaned tool result with ToolCallID %s", m.ToolCallID)
			}
		}
	}
}

func TestTruncationCompactor_SmallMessages(t *testing.T) {
	// When messages are fewer than keepRecent, no compaction.
	c := NewTruncationCompactor(100, 50)
	msgs := makeMessages(5)

	result, err := c.Compact(msgs)
	if err != nil {
		t.Fatal(err)
	}
	if result != nil {
		t.Error("expected no compaction for small message count")
	}
}

func TestSlidingWindowCompactor_NoCompactionNeeded(t *testing.T) {
	c := NewSlidingWindowCompactor(20)
	msgs := makeMessages(5)

	result, err := c.Compact(msgs)
	if err != nil {
		t.Fatal(err)
	}
	if result != nil {
		t.Error("expected nil when within window")
	}
}

func TestSlidingWindowCompactor_Compacts(t *testing.T) {
	c := NewSlidingWindowCompactor(5)
	msgs := makeMessages(20) // system + 20 = 21

	result, err := c.Compact(msgs)
	if err != nil {
		t.Fatal(err)
	}
	if result == nil {
		t.Fatal("expected compaction")
	}

	if result.OldCount != 21 {
		t.Errorf("expected OldCount 21, got %d", result.OldCount)
	}
	if result.NewCount > 6 { // system + 5 recent
		t.Errorf("expected at most 6 messages, got %d", result.NewCount)
	}
}

func TestSlidingWindowCompactor_PreservesSystem(t *testing.T) {
	c := NewSlidingWindowCompactor(3)
	msgs := []provider.Message{
		{Role: provider.RoleSystem, Content: "system"},
		{Role: provider.RoleUser, Content: "q1"},
		{Role: provider.RoleAssistant, Content: "a1"},
		{Role: provider.RoleUser, Content: "q2"},
		{Role: provider.RoleAssistant, Content: "a2"},
	}

	result, err := c.Compact(msgs)
	if err != nil {
		t.Fatal(err)
	}
	if result == nil {
		t.Fatal("expected compaction")
	}

	if result.Compacted[0].Role != provider.RoleSystem {
		t.Error("system message not preserved")
	}
}

func TestNewCompactor_DefaultsToTruncation(t *testing.T) {
	c := NewCompactor(Config{})
	if _, ok := c.(*TruncationCompactor); !ok {
		t.Errorf("expected TruncationCompactor, got %T", c)
	}
}

func TestNewCompactor_SlidingWindow(t *testing.T) {
	c := NewCompactor(Config{Strategy: StrategySliding, KeepRecent: 10})
	if _, ok := c.(*SlidingWindowCompactor); !ok {
		t.Errorf("expected SlidingWindowCompactor, got %T", c)
	}
}

func TestConfig_Defaults(t *testing.T) {
	c := Config{}.Defaults()
	if c.MaxMessages != defaultMaxMessages {
		t.Errorf("expected MaxMessages %d, got %d", defaultMaxMessages, c.MaxMessages)
	}
	if c.KeepRecent != defaultKeepRecent {
		t.Errorf("expected KeepRecent %d, got %d", defaultKeepRecent, c.KeepRecent)
	}
	if c.Strategy != StrategyTruncation {
		t.Errorf("expected Strategy %q, got %q", StrategyTruncation, c.Strategy)
	}
}
