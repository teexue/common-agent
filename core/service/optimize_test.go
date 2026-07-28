package service

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/provider"
)

// staticProvider replies with a fixed text on every Stream call.
type staticProvider struct{ text string }

func (s staticProvider) Stream(context.Context, provider.Request) (<-chan provider.Chunk, error) {
	ch := make(chan provider.Chunk, 2)
	ch <- provider.Chunk{TextDelta: s.text}
	ch <- provider.Chunk{Done: true}
	close(ch)
	return ch, nil
}

// doneOnlyProvider returns a stream that completes without any text,
// simulating an empty LLM response.
type doneOnlyProvider struct{}

func (doneOnlyProvider) Stream(context.Context, provider.Request) (<-chan provider.Chunk, error) {
	ch := make(chan provider.Chunk, 1)
	ch <- provider.Chunk{Done: true}
	close(ch)
	return ch, nil
}

func TestOptimizeUserPrompt_Enabled(t *testing.T) {
	a := &agent.Agent{Name: "t", Model: "m", Optimize: &agent.OptimizeConfig{UserPrompt: true}}
	got := OptimizeUserPrompt(context.Background(), a, staticProvider{"优化后的问题"}, "原始问题", nil)
	assert.Equal(t, "优化后的问题", got)
}

func TestOptimizeUserPrompt_Disabled(t *testing.T) {
	a := &agent.Agent{Name: "t", Model: "m"}
	got := OptimizeUserPrompt(context.Background(), a, staticProvider{"优化后的问题"}, "原始问题", nil)
	assert.Equal(t, "原始问题", got)
}

func TestOptimizeUserPrompt_EmptyResponseFallsBack(t *testing.T) {
	a := &agent.Agent{Name: "t", Model: "m", Optimize: &agent.OptimizeConfig{UserPrompt: true}}
	got := OptimizeUserPrompt(context.Background(), a, doneOnlyProvider{}, "原始问题", nil)
	assert.Equal(t, "原始问题", got)
}

func TestOptimizeUserPrompt_SkipsMockProvider(t *testing.T) {
	// MockProvider's scripted responses must be reserved for the actual run.
	a := &agent.Agent{Name: "t", Model: "m", Optimize: &agent.OptimizeConfig{UserPrompt: true}}
	mock := &provider.MockProvider{Calls: [][]provider.MockStep{{{Text: "run reply"}}}}
	got := OptimizeUserPrompt(context.Background(), a, mock, "原始问题", nil)
	assert.Equal(t, "原始问题", got)
}

func TestOptimizeSystemPrompt_Enabled(t *testing.T) {
	optimized := "<role>助手</role>\n<tone>专业</tone>"
	a := &agent.Agent{Name: "t", Model: "m", SystemPrompt: "raw prompt",
		Optimize: &agent.OptimizeConfig{SystemPrompt: true}}

	OptimizeSystemPrompt(context.Background(), nil, a, staticProvider{optimized}, nil)
	assert.Equal(t, optimized, a.SystemPrompt)
}

func TestOptimizeSystemPrompt_Disabled(t *testing.T) {
	a := &agent.Agent{Name: "t", Model: "m", SystemPrompt: "raw prompt"}

	OptimizeSystemPrompt(context.Background(), nil, a, staticProvider{"<role>助手</role>"}, nil)
	assert.Equal(t, "raw prompt", a.SystemPrompt)
}

func TestOptimizeSystemPrompt_InvalidOutputFallsBack(t *testing.T) {
	a := &agent.Agent{Name: "t", Model: "m", SystemPrompt: "raw prompt",
		Optimize: &agent.OptimizeConfig{SystemPrompt: true}}

	// Optimizer output without the required tags is rejected.
	OptimizeSystemPrompt(context.Background(), nil, a, staticProvider{"plain text"}, nil)
	assert.Equal(t, "raw prompt", a.SystemPrompt)
}

func TestOptimizeSystemPrompt_SkipsMockProvider(t *testing.T) {
	a := &agent.Agent{Name: "t", Model: "m", SystemPrompt: "raw prompt",
		Optimize: &agent.OptimizeConfig{SystemPrompt: true}}
	mock := &provider.MockProvider{Calls: [][]provider.MockStep{{{Text: "<role>x</role>"}}}}

	OptimizeSystemPrompt(context.Background(), nil, a, mock, nil)
	assert.Equal(t, "raw prompt", a.SystemPrompt)
}

// countingProvider returns tagged output and records how many Stream calls it served.
type countingProvider struct{ calls int }

func (c *countingProvider) Stream(context.Context, provider.Request) (<-chan provider.Chunk, error) {
	c.calls++
	ch := make(chan provider.Chunk, 2)
	ch <- provider.Chunk{TextDelta: "<role>助手</role>"}
	ch <- provider.Chunk{Done: true}
	close(ch)
	return ch, nil
}

func TestOptimizeSystemPrompt_UsesCache(t *testing.T) {
	a := &agent.Agent{Name: "t", Model: "m", SystemPrompt: "raw prompt",
		Optimize: &agent.OptimizeConfig{SystemPrompt: true}}
	var cache sync.Map
	p := &countingProvider{}

	OptimizeSystemPrompt(context.Background(), &cache, a, p, nil)
	require.Equal(t, "<role>助手</role>", a.SystemPrompt)

	// Second call with the same raw content must hit the cache.
	a.SystemPrompt = "raw prompt"
	OptimizeSystemPrompt(context.Background(), &cache, a, p, nil)
	assert.Equal(t, "<role>助手</role>", a.SystemPrompt)
	assert.Equal(t, 1, p.calls)
}
