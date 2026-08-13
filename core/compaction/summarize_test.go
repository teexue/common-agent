package compaction

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/provider"
)

func TestSummarizingCompactor_NoCompactionNeeded(t *testing.T) {
	mock := &provider.MockProvider{}
	c := NewSummarizingCompactor(SummarizeConfig{
		Provider: mock, Model: "m", TokenLimit: 100_000, KeepRecent: 10,
	})
	msgs := []provider.Message{
		{Role: provider.RoleSystem, Content: "sys"},
		{Role: provider.RoleUser, Content: "hi"},
	}
	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	assert.Nil(t, res)
	// No LLM call when compaction isn't needed.
	assert.Equal(t, 0, mock.StreamCallCount())
}

func TestSummarizingCompactor_SummarizesOldTurns(t *testing.T) {
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{{{Text: "用户想升级依赖并重新构建"}}},
	}
	c := NewSummarizingCompactor(SummarizeConfig{
		Provider: mock, Model: "m", TokenLimit: 300, KeepRecent: 4,
	})

	big := strings.Repeat("x", 2000) // ~660 tokens each
	msgs := []provider.Message{{Role: provider.RoleSystem, Content: "system prompt"}}
	for i := 0; i < 6; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: big})
		msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: big})
	}

	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	require.Equal(t, 1, mock.StreamCallCount(), "summarization should call the model once")

	// The compacted list keeps system prompt, stable head, one summary message
	// (user role, so it does not pollute the system prefix), and recent turns.
	first := res.Compacted[0]
	assert.Equal(t, provider.RoleSystem, first.Role)
	foundSummary := false
	var keptCount int
	for _, m := range res.Compacted {
		if strings.Contains(m.Content, "用户想升级依赖并重新构建") {
			foundSummary = true
		}
		if m.Role != provider.RoleSystem && !strings.HasPrefix(m.Content, summaryMarker) {
			keptCount++
		}
	}
	assert.True(t, foundSummary, "summary text should appear in compacted messages")
	assert.LessOrEqual(t, keptCount, 6, "head + recent turns kept verbatim")
	assert.Less(t, res.NewCount, res.OldCount)
}

func TestSummarizingCompactor_FallsBackOnProviderError(t *testing.T) {
	// A provider that errors: MockProvider with no predefined calls returns
	// an empty chunk without error, so use a failing provider stub.
	c := NewSummarizingCompactor(SummarizeConfig{
		Provider: &failingProvider{}, Model: "m", TokenLimit: 300, KeepRecent: 2,
	})
	big := strings.Repeat("y", 2000)
	msgs := []provider.Message{{Role: provider.RoleSystem, Content: "sys"}}
	for i := 0; i < 4; i++ {
		msgs = append(msgs, provider.Message{Role: provider.RoleUser, Content: big})
		msgs = append(msgs, provider.Message{Role: provider.RoleAssistant, Content: big})
	}

	res, err := c.Compact(context.Background(), msgs)
	require.NoError(t, err)
	require.NotNil(t, res)
	// Fallback summary marks the failure but compaction still happened.
	assert.Contains(t, res.Summary, "summarization unavailable")
	assert.Less(t, res.NewCount, res.OldCount)
}

// failingProvider is a Provider whose Stream always errors.
type failingProvider struct{}

func (f *failingProvider) Stream(context.Context, provider.Request) (<-chan provider.Chunk, error) {
	return nil, assert.AnError
}
