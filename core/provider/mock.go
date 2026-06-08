package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// MockStep defines one provider response in sequence within a single Stream call.
type MockStep struct {
	Text      string
	Reasoning string
	ToolCalls []ToolCall
}

// MockProvider returns predefined streaming steps for tests and offline demos.
// Each Stream invocation consumes the next entry in Calls.
// If BlockOnStream is true, Stream blocks until the context is cancelled
// when there are no more predefined calls (useful for testing cancellation).
type MockProvider struct {
	Calls         [][]MockStep
	BlockOnStream bool
	mu            sync.Mutex
	index         int
}

// Stream implements Provider.
func (m *MockProvider) Stream(ctx context.Context, req Request) (<-chan Chunk, error) {
	m.mu.Lock()
	var steps []MockStep
	if m.index < len(m.Calls) {
		steps = m.Calls[m.index]
	}
	m.index++
	m.mu.Unlock()

	ch := make(chan Chunk)
	go func() {
		defer close(ch)
		if len(steps) == 0 {
			if m.BlockOnStream {
				// Block until context is cancelled.
				<-ctx.Done()
				return
			}
			select {
			case <-ctx.Done():
			case ch <- Chunk{TextDelta: "mock empty response", Done: true}:
			}
			return
		}
		for i, step := range steps {
			select {
			case <-ctx.Done():
				return
			default:
			}
			if step.Reasoning != "" {
				for _, r := range step.Reasoning {
					select {
					case <-ctx.Done():
						return
					case ch <- Chunk{ReasoningDelta: string(r)}:
					}
				}
			}
			if step.Text != "" {
				for _, r := range step.Text {
					select {
					case <-ctx.Done():
						return
					case ch <- Chunk{TextDelta: string(r)}:
					}
				}
			}
			if len(step.ToolCalls) > 0 {
				select {
				case <-ctx.Done():
					return
				case ch <- Chunk{ToolCalls: step.ToolCalls}:
				}
			}
			if i == len(steps)-1 {
				select {
				case <-ctx.Done():
					return
				case ch <- Chunk{Done: true}:
				}
			}
		}
	}()
	return ch, nil
}

// EchoThenReply builds a mock that calls echo on first turn then replies on second.
func EchoThenReply(message string) *MockProvider {
	args, _ := json.Marshal(map[string]string{"message": message})
	return &MockProvider{
		Calls: [][]MockStep{
			{{
				ToolCalls: []ToolCall{{
					ID:        "call_1",
					Name:      "echo",
					Arguments: args,
				}},
			}},
			{{Text: fmt.Sprintf("Echo result received for: %s", message)}},
		},
	}
}
