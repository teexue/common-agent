package loop

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/provider"
)

func TestConsumeStreamAggregatesCacheTokens(t *testing.T) {
	chunks := make(chan provider.Chunk, 3)
	chunks <- provider.Chunk{TextDelta: "hi"}
	chunks <- provider.Chunk{Done: true, InputTokens: 100, OutputTokens: 10, CacheReadInputTokens: 80, CacheCreationInputTokens: 20}
	close(chunks)

	out := make(chan event.Event, 16)
	_, _, _, tokens, cancelled := consumeStream(context.Background(), chunks, out)
	require.False(t, cancelled)
	assert.Equal(t, 100, tokens.input)
	assert.Equal(t, 10, tokens.output)
	assert.Equal(t, 80, tokens.cacheRead)
	assert.Equal(t, 20, tokens.cacheCreation)
}

func TestEmitCancelledCarriesCacheStats(t *testing.T) {
	out := make(chan event.Event, 4)
	emitCancelled(out, "sess-1", 2, 100, 50, 80, 20, 128000)
	close(out)

	var done *event.Event
	for ev := range out {
		if ev.Type == event.TypeDone {
			done = &ev
		}
	}
	require.NotNil(t, done)
	assert.Equal(t, "cancelled", done.Status)
	assert.Equal(t, 100, done.InputTokens)
	assert.Equal(t, 80, done.CacheReadInputTokens)
	assert.Equal(t, 20, done.CacheCreationInputTokens)
}
