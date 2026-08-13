package compaction

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/provider"
)

func TestNeedsCompaction(t *testing.T) {
	msgs := make([]provider.Message, 5)
	assert.False(t, NeedsCompaction(msgs, 0))
	assert.False(t, NeedsCompaction(msgs, 10))
	assert.True(t, NeedsCompaction(msgs, 3))
}

func TestNeedsCompactionByTokens(t *testing.T) {
	msgs := []provider.Message{{Role: provider.RoleUser, Content: strings.Repeat("字", 300)}}
	est := EstimateTokens(msgs)
	require.Greater(t, est, 0)
	assert.False(t, NeedsCompactionByTokens(msgs, 0))
	assert.False(t, NeedsCompactionByTokens(msgs, est+10))
	assert.True(t, NeedsCompactionByTokens(msgs, est-1))
}

func TestResolveTokenLimit(t *testing.T) {
	assert.Equal(t, 0, ResolveTokenLimit(0, 4096, 0.85))
	limit := ResolveTokenLimit(128000, 4096, 0.85)
	assert.Equal(t, int(128000*0.85)-4096, limit)
}

func TestTruncationCompactor_NoCompactionNeeded(t *testing.T) {
	c := NewTruncationCompactor(100_000, 0, 10)
	msgs := []provider.Message{
		{Role: provider.RoleSystem, Content: "sys"},
		{Role: provider.RoleUser, Content: "hi"},
	}
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	assert.Nil(t, res)
}

func TestTruncationCompactor_CompactsByTokens(t *testing.T) {
	big := strings.Repeat("x", 3000) // ~1000 tokens each
	msgs := []provider.Message{
		{Role: provider.RoleSystem, Content: "system"},
	}
	for i := 0; i < 8; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: big})
		msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: big})
	}
	c := NewTruncationCompactor(2500, 0, 4)
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Less(t, res.NewCount, res.OldCount)
	assert.Equal(t, provider.RoleSystem, res.Compacted[0].Role)
	// keepRecent floor may still exceed tokenLimit when each message is huge;
	// compaction still drops older turns. The facts placeholder is not dialog.
	conv := 0
	for _, m := range res.Compacted {
		if m.Role != provider.RoleSystem && !strings.HasPrefix(m.Content, factsMarker) {
			conv++
		}
	}
	assert.LessOrEqual(t, conv, 6) // head (2) + recent (4)
	assert.Contains(t, res.Summary, factsMarker)
}

func TestTruncationCompactor_PreservesToolPairs(t *testing.T) {
	big := strings.Repeat("y", 3000)
	msgs := []provider.Message{
		{Role: provider.RoleSystem, Content: "sys"},
		{Role: provider.RoleUser, Content: big},
		{Role: provider.RoleAssistant, Content: big},
		{Role: provider.RoleUser, Content: "q"},
		{Role: provider.RoleAssistant, ToolCalls: []provider.ToolCall{{ID: "c1", Name: "echo", Arguments: []byte(`{}`)}}},
		{Role: provider.RoleTool, ToolCallID: "c1", Name: "echo", Content: `{"ok":true}`},
	}
	c := NewTruncationCompactor(800, 0, 3)
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	var toolCount, assistantWithTools int
	for _, m := range res.Compacted {
		if m.Role == provider.RoleTool {
			toolCount++
		}
		if m.Role == provider.RoleAssistant && len(m.ToolCalls) > 0 {
			assistantWithTools++
		}
	}
	assert.Equal(t, toolCount, assistantWithTools)
}

func TestTruncationCompactor_LegacyMaxMessages(t *testing.T) {
	msgs := make([]provider.Message, 0, 20)
	msgs = append(msgs, provider.Message{Role: provider.RoleSystem, Content: "sys"})
	for i := 0; i < 15; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: "u"})
	}
	c := NewTruncationCompactor(0, 8, 5)
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.LessOrEqual(t, res.NewCount, 8+2) // system + summary + recent
}

func TestSlidingWindowCompactor_Compacts(t *testing.T) {
	c := NewSlidingWindowCompactor(5)
	msgs := make([]provider.Message, 0, 12)
	msgs = append(msgs, provider.Message{Role: provider.RoleSystem, Content: "sys"})
	for i := 0; i < 10; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: "u"})
	}
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
}

func TestNewCompactor_DefaultsToTruncation(t *testing.T) {
	c := NewCompactor(Config{TokenLimit: 1000})
	_, ok := c.(*TruncationCompactor)
	assert.True(t, ok)
}

func TestNewCompactor_SlidingWindow(t *testing.T) {
	c := NewCompactor(Config{Strategy: StrategySliding, KeepRecent: 10})
	_, ok := c.(*SlidingWindowCompactor)
	assert.True(t, ok)
}

func TestEstimateTokens_CJKWeighting(t *testing.T) {
	// 60 CJK chars should cost ~60 tokens, not the inflated byte-based count.
	cjk := strings.Repeat("围棋对弈测试", 10) // 6 runes * 10 = 60
	assert.Equal(t, 60, estimateString(cjk))

	// ASCII follows the ~4 bytes/token convention.
	ascii := "hello world this is a test message"
	assert.Equal(t, (len(ascii)+3)/4, estimateString(ascii))

	// Mixed: 10 CJK chars (30 bytes) + 20 ASCII bytes.
	mixed := strings.Repeat("字", 10) + strings.Repeat("a", 20)
	assert.Equal(t, 10+(20+3)/4, estimateString(mixed))

	// Per-message overhead applies on top of content.
	msgs := []provider.Message{{Role: provider.RoleUser, Content: strings.Repeat("字", 10)}}
	assert.Equal(t, 10+4, EstimateTokens(msgs))
}

func TestNeedsCompactionByTokensCount(t *testing.T) {
	assert.False(t, NeedsCompactionByTokensCount(100, 0))
	assert.False(t, NeedsCompactionByTokensCount(100, 200))
	assert.True(t, NeedsCompactionByTokensCount(300, 200))
}

func TestTruncationCompactor_UsesCurrentTokensForTrigger(t *testing.T) {
	msgs := make([]provider.Message, 0, 12)
	msgs = append(msgs, provider.Message{Role: provider.RoleSystem, Content: "sys"})
	for i := 0; i < 10; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: "hi"})
	}
	est := EstimateTokens(msgs)

	// The raw estimate is far below the limit, so without CurrentTokens
	// nothing would happen. Real usage far over the limit must trigger.
	c := NewTruncationCompactor(2000, 0, 3)
	c.currentTokens = est + 100_000
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Less(t, res.NewCount, res.OldCount)

	// A small known usage must not trigger even though the raw estimate
	// exceeds the limit.
	smallMsgs := []provider.Message{{Role: provider.RoleUser, Content: strings.Repeat("字", 3000)}}
	c2 := NewTruncationCompactor(100, 0, 2)
	c2.currentTokens = 10
	res2, err := c2.Compact(context.Background(), smallMsgs)
	require.NoError(t, err)
	assert.Nil(t, res2)
}

func TestTruncationCompactor_TrialScalesWithCurrentTokens(t *testing.T) {
	// Each message is large in bytes (raw estimate ~1000 tokens each), but
	// the known real usage is only slightly over the limit. The trial should
	// scale down and avoid over-trimming.
	big := strings.Repeat("x", 4000)
	msgs := []provider.Message{{Role: provider.RoleSystem, Content: "sys"}}
	for i := 0; i < 8; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: big})
		msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: big})
	}
	c := NewTruncationCompactor(1000, 0, 4)
	c.currentTokens = 1500 // real usage just over the 1000 limit
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)

	// Without scaling, the raw estimate (~16k) would force trimming down to
	// keepRecent=4. With scaling, much more history survives.
	conv := 0
	for _, m := range res.Compacted {
		if m.Role != provider.RoleSystem && !strings.HasPrefix(m.Content, "[Context compacted:") {
			conv++
		}
	}
	assert.Greater(t, conv, 4, "scaled trial should keep more than keepRecent")
}

func TestSummarizingCompactor_UsesCurrentTokensForTrigger(t *testing.T) {
	mock := &provider.MockProvider{Calls: [][]provider.MockStep{{{Text: "摘要"}}}}
	c := NewSummarizingCompactor(SummarizeConfig{
		Provider: mock, Model: "m", TokenLimit: 100_000, KeepRecent: 1,
	})
	c.currentTokens = 200_000

	msgs := []provider.Message{{Role: provider.RoleSystem, Content: "sys"}}
	for i := 0; i < 8; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: "hi"})
	}
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, 1, mock.StreamCallCount())
}

func TestSummarizingCompactor_IncrementalDelta(t *testing.T) {
	mock := &provider.MockProvider{Calls: [][]provider.MockStep{
		{{Text: "第一版摘要"}},
		{{Text: "第二版摘要"}},
	}}
	c := NewSummarizingCompactor(SummarizeConfig{
		Provider: mock, Model: "m", TokenLimit: 300, KeepRecent: 2,
	})
	big := strings.Repeat("x", 2000)
	msgs := []provider.Message{{Role: provider.RoleSystem, Content: "sys"}}
	for i := 0; i < 4; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: big})
		msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: big})
	}
	res1, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res1)
	require.Equal(t, 1, mock.StreamCallCount())

	// Grow the session with new large turns; they fall outside keepRecent and
	// become new history. The second pass must summarize only the delta.
	msgs2 := append([]provider.Message{}, res1.Compacted...)
	for i := 0; i < 2; i++ {
		msgs2 = append(msgs2, provider.Message{Role: provider.RoleUser, Content: big})
		msgs2 = append(msgs2, provider.Message{Role: provider.RoleAssistant, Content: big})
	}
	res2, err := c.Compact(context.Background(), msgs2)
	require.NoError(t, err)
	require.NotNil(t, res2)
	require.Equal(t, 2, mock.StreamCallCount(), "incremental pass should summarize the delta once")
	assert.Contains(t, res2.Summary, "第二版摘要")
	// The summary message stays a user-role message so the system prefix is stable.
	assert.Equal(t, provider.RoleSystem, res2.Compacted[0].Role)
}

func TestSummarizingCompactor_IncrementalNoDeltaReusesSummary(t *testing.T) {
	mock := &provider.MockProvider{} // would error if Stream is called
	c := NewSummarizingCompactor(SummarizeConfig{
		Provider: mock, Model: "m", TokenLimit: 300, KeepRecent: 3,
	})
	big := strings.Repeat("x", 2000)
	// A session that already contains a summary message: system + head (2) +
	// summary + recent (3 large). The recent messages stay inside keepRecent,
	// so there is no new history to summarize — the existing summary is reused
	// without an LLM call.
	msgs := []provider.Message{
		{Role: provider.RoleSystem, Content: "sys"},
		{Role: provider.RoleUser, Content: "u0"},
		{Role: provider.RoleAssistant, Content: "a0"},
		{Role: provider.RoleUser, Content: summaryMarker + "第一版摘要"},
		{Role: provider.RoleUser, Content: big},
		{Role: provider.RoleAssistant, Content: big},
		{Role: provider.RoleUser, Content: big},
	}
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, 0, mock.StreamCallCount(), "no LLM call when only recent turns grew")
	assert.Contains(t, res.Summary, "第一版摘要")
	// The summary message survives in the compacted list.
	found := false
	for _, m := range res.Compacted {
		if strings.HasPrefix(m.Content, summaryMarker) {
			found = true
		}
	}
	assert.True(t, found)
}

func TestTruncationCompactor_ProgressiveDropsToolPairs(t *testing.T) {
	big := strings.Repeat("tool output\n", 1000) // large tool result
	msgs := []provider.Message{{Role: provider.RoleSystem, Content: "sys"}}
	msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: "u0"})
	msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: "a0"})
	for i := 0; i < 6; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, ToolCalls: []provider.ToolCall{{ID: "c" + string(rune('a'+i)), Name: "run"}}})
		msgs = append(msgs, provider.Message{Role: provider.RoleTool, ToolCallID: "c" + string(rune('a'+i)), Name: "run", Content: big})
	}
	msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: "middle-1"})
	msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: "middle-2"})
	msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: "r1"})
	msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: "r2"})
	msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: "r3"})
	msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: "r4"})

	c := NewTruncationCompactor(200, 0, 4)
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)

	// Plain dialog survives: head, middle dialog, and recent are all kept.
	var joined strings.Builder
	for _, m := range res.Compacted {
		joined.WriteString(m.Content)
		joined.WriteString("\n")
	}
	s := joined.String()
	assert.Contains(t, s, "u0")
	assert.Contains(t, s, "a0")
	assert.Contains(t, s, "middle-1")
	assert.Contains(t, s, "middle-2")
	assert.Contains(t, s, "r4")
	// Old tool results were dropped: no kept dialog message contains the raw
	// tool output (the facts block keeps only a short bounded trace).
	for _, m := range res.Compacted {
		if strings.HasPrefix(m.Content, factsMarker) {
			continue
		}
		assert.NotContains(t, m.Content, "tool output")
	}
	// Facts preserve a trace of what was dropped.
	assert.Contains(t, res.Summary, "工具")
}

func TestTruncationCompactor_KeepsStableHead(t *testing.T) {
	big := strings.Repeat("z", 3000)
	msgs := []provider.Message{{Role: provider.RoleSystem, Content: "sys"}}
	msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: "task-def"})
	msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: "understood"})
	for i := 0; i < 6; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: big})
		msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: big})
	}
	// Limit large enough that head (2) + recent (4) fit, but the full history
	// does not: the middle is dropped while the stable head survives.
	c := NewTruncationCompactor(5000, 0, 4)
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	// system + head (2 oldest) are the stable prefix.
	assert.Equal(t, provider.RoleSystem, res.Compacted[0].Role)
	assert.Equal(t, "task-def", res.Compacted[1].Content)
	assert.Equal(t, "understood", res.Compacted[2].Content)
}
