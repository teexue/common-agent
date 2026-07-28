package compaction

import (
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
	res, err := c.Compact(msgs)
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
	res, err := c.Compact(msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Less(t, res.NewCount, res.OldCount)
	assert.Equal(t, provider.RoleSystem, res.Compacted[0].Role)
	// keepRecent floor may still exceed tokenLimit when each message is huge;
	// compaction still drops older turns.
	conv := 0
	for _, m := range res.Compacted {
		if m.Role != provider.RoleSystem && !strings.HasPrefix(m.Content, "[Context compacted:") {
			conv++
		}
	}
	assert.LessOrEqual(t, conv, 4)
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
	res, err := c.Compact(msgs)
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
	res, err := c.Compact(msgs)
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
	res, err := c.Compact(msgs)
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
