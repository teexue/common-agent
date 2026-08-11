package provider

import (
	"context"
	"strings"
	"testing"
)

// collectStream feeds an SSE payload through readStream and returns the chunks.
func collectStream(t *testing.T, payload string) []Chunk {
	t.Helper()
	a := &Anthropic{}
	ch := make(chan Chunk, 64)
	a.readStream(context.Background(), strings.NewReader(payload), ch)
	close(ch)
	var out []Chunk
	for c := range ch {
		out = append(out, c)
	}
	return out
}

func findToolCalls(chunks []Chunk) []ToolCall {
	var calls []ToolCall
	for _, c := range chunks {
		calls = append(calls, c.ToolCalls...)
	}
	return calls
}

// DeepSeek's Anthropic-compatible endpoint may deliver the complete tool
// input inside content_block_start instead of streaming input_json_delta.
func TestAnthropicStreamToolInputAtBlockStart(t *testing.T) {
	payload := `event: message_start
data: {"type":"message_start","message":{"usage":{"input_tokens":12}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call_1","name":"read_file","input":{"path":"/tmp/a.txt"}}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":5}}

event: message_stop
data: {"type":"message_stop"}

`
	calls := findToolCalls(collectStream(t, payload))
	if len(calls) != 1 {
		t.Fatalf("got %d tool calls, want 1", len(calls))
	}
	if calls[0].Name != "read_file" {
		t.Fatalf("tool name = %q", calls[0].Name)
	}
	if string(calls[0].Arguments) != `{"path":"/tmp/a.txt"}` {
		t.Fatalf("tool arguments = %s", calls[0].Arguments)
	}
}

// Argument-less tools (e.g. get_time) may arrive with no input_json_delta at
// all; the tool call must still be emitted with empty-object arguments.
func TestAnthropicStreamToolWithoutArguments(t *testing.T) {
	payload := `event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call_1","name":"get_time","input":{}}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_stop
data: {"type":"message_stop"}

`
	calls := findToolCalls(collectStream(t, payload))
	if len(calls) != 1 {
		t.Fatalf("got %d tool calls, want 1", len(calls))
	}
	if calls[0].Name != "get_time" {
		t.Fatalf("tool name = %q", calls[0].Name)
	}
	if string(calls[0].Arguments) != "{}" {
		t.Fatalf("tool arguments = %s, want {}", calls[0].Arguments)
	}
}

// Standard streamed input_json_delta accumulation must keep working.
func TestAnthropicStreamToolStreamedInput(t *testing.T) {
	payload := `event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call_1","name":"write_file","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"path\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\"a\"}"}}

event: message_stop
data: {"type":"message_stop"}

`
	calls := findToolCalls(collectStream(t, payload))
	if len(calls) != 1 {
		t.Fatalf("got %d tool calls, want 1", len(calls))
	}
	if string(calls[0].Arguments) != `{"path":"a"}` {
		t.Fatalf("tool arguments = %s", calls[0].Arguments)
	}
}

// thinking_delta events should surface as reasoning deltas.
func TestAnthropicStreamThinkingDelta(t *testing.T) {
	payload := `event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"let me think"}}

event: message_stop
data: {"type":"message_stop"}

`
	var reasoning string
	for _, c := range collectStream(t, payload) {
		reasoning += c.ReasoningDelta
	}
	if reasoning != "let me think" {
		t.Fatalf("reasoning = %q", reasoning)
	}
}
