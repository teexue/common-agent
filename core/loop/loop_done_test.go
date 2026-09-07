package loop_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func TestRunDoneCarriesContextWindow(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())
	reg.MustRegister(echoTool{})

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "deepseek-v4-pro",
		MaxTurns:     3,
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: provider.EchoThenReply("hello"),
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "hello",
	})
	require.NoError(t, err)

	var done *event.Event
	for ev := range events {
		if ev.Type == event.TypeDone {
			done = &ev
		}
	}
	require.NotNil(t, done, "expected done event")
	assert.Equal(t, "completed", done.Status)
	// deepseek-v4-pro resolves to the official 1M context window.
	assert.Equal(t, 1_000_000, done.ContextWindow)
}

func TestDoneCarriesConfiguredContextWindow(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())
	reg.MustRegister(echoTool{})

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "unknown-model",
		MaxTurns:     3,
		Compaction:   &agent.CompactionConfig{ContextWindow: 256000},
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: provider.EchoThenReply("hello"),
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "hello",
	})
	require.NoError(t, err)

	var done *event.Event
	for ev := range events {
		if ev.Type == event.TypeDone {
			done = &ev
		}
	}
	require.NotNil(t, done, "expected done event")
	assert.Equal(t, 256000, done.ContextWindow)
}

type cacheAwareProvider struct{}

func (cacheAwareProvider) Stream(ctx context.Context, _ provider.Request) (<-chan provider.Chunk, error) {
	ch := make(chan provider.Chunk, 2)
	ch <- provider.Chunk{TextDelta: "hello"}
	ch <- provider.Chunk{Done: true, InputTokens: 100, OutputTokens: 20, CacheReadInputTokens: 70, CacheCreationInputTokens: 30}
	close(ch)
	return ch, nil
}

// Done events should carry prompt cache stats reported by the provider.
func TestRunDoneCarriesCacheStats(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())
	reg.MustRegister(echoTool{})

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "unknown-model",
		MaxTurns:     1,
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: cacheAwareProvider{},
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "hello",
	})
	require.NoError(t, err)

	var done *event.Event
	for ev := range events {
		if ev.Type == event.TypeDone {
			done = &ev
		}
	}
	require.NotNil(t, done)
	assert.Equal(t, "completed", done.Status)
	assert.Equal(t, 100, done.InputTokens)
	assert.Equal(t, 20, done.OutputTokens)
	assert.Equal(t, 70, done.CacheReadInputTokens)
	assert.Equal(t, 30, done.CacheCreationInputTokens)
}

func TestRunDoneTruncatedWhenHittingMaxTokens(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())
	reg.MustRegister(echoTool{})

	sc := &agent.Agent{
		Name: "test", Provider: "mock", SystemPrompt: "test",
		Tools: []string{"echo"}, Model: "unknown-model",
		MaxTurns: 1, MaxTokens: 8000,
	}
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{{
			{Text: "cut off", OutputTokens: 8000, FinishReason: "length"},
		}},
	}
	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock, Registry: reg, Agent: sc,
		Session: session.New(sc.Name), Prompt: "hello",
	})
	require.NoError(t, err)

	var done *event.Event
	for ev := range events {
		if ev.Type == event.TypeDone {
			done = &ev
		}
	}
	require.NotNil(t, done)
	assert.Equal(t, "completed", done.Status)
	assert.True(t, done.Truncated)
	assert.Equal(t, 8000, done.OutputTokens)
}
