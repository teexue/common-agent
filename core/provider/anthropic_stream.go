package provider

import (
	"context"
	"encoding/json"
	"io"
)

// readStream parses the Anthropic SSE body and emits chunks until the
// message completes or the context is cancelled.
func (a *Anthropic) readStream(ctx context.Context, r io.Reader, ch chan<- Chunk) {
	scanner := NewSSEScanner(r)

	toolAcc := map[int]*ToolCall{}
	lastToolIdx := -1
	var inputTokens, outputTokens, cacheRead, cacheCreation int

	flushLastTool := func() {
		if lastToolIdx < 0 {
			return
		}
		tc := toolAcc[lastToolIdx]
		// Emit the tool call even with empty arguments: compatible vendors may
		// send no input_json_delta for argument-less tools (e.g. get_time).
		if tc == nil || tc.Name == "" {
			return
		}
		if len(tc.Arguments) == 0 {
			tc.Arguments = json.RawMessage("{}")
		}
		select {
		case <-ctx.Done():
		case ch <- Chunk{ToolCalls: []ToolCall{*tc}}:
		}
	}

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := scanner.Text()
		data, ok := ParseSSELine(line)
		if !ok {
			continue
		}

		var ev anthropicStreamEvent
		if err := json.Unmarshal([]byte(data), &ev); err != nil {
			continue
		}

		sec := StreamEventContext{Ctx: ctx, Ch: ch, ToolAcc: toolAcc, LastToolIdx: &lastToolIdx, FlushLastTool: flushLastTool, InputTokens: inputTokens, OutputTokens: outputTokens, CacheReadInputTokens: cacheRead, CacheCreationInputTokens: cacheCreation}
		done, tokens := a.processStreamEvent(sec, ev)
		if tokens != nil {
			inputTokens, outputTokens = tokens.InputTokens, tokens.OutputTokens
			cacheRead, cacheCreation = tokens.CacheReadInputTokens, tokens.CacheCreationInputTokens
		}
		if done {
			return
		}
	}
	flushLastTool()
}

// StreamEventContext holds state for processing Anthropic SSE events.
type StreamEventContext struct {
	Ctx                      context.Context
	Ch                       chan<- Chunk
	ToolAcc                  map[int]*ToolCall
	LastToolIdx              *int
	FlushLastTool            func()
	InputTokens              int
	OutputTokens             int
	CacheReadInputTokens     int
	CacheCreationInputTokens int
}

// processStreamEvent processes a single Anthropic SSE event. Returns (finished, tokenUpdate).
func (a *Anthropic) processStreamEvent(sec StreamEventContext, ev anthropicStreamEvent) (bool, *Chunk) {
	switch ev.Type {
	case "message_start":
		applyMessageStart(&sec, ev)
	case "content_block_start":
		applyContentBlockStart(&sec, ev)
	case "content_block_delta":
		if done := handleContentBlockDelta(sec, ev); done {
			return true, nil
		}
	case "message_delta":
		return applyMessageDelta(&sec, ev)
	case "message_stop":
		sec.FlushLastTool()
		sendChunk(sec.Ctx, sec.Ch, Chunk{Done: true, InputTokens: sec.InputTokens, OutputTokens: sec.OutputTokens, CacheReadInputTokens: sec.CacheReadInputTokens, CacheCreationInputTokens: sec.CacheCreationInputTokens})
		return true, nil
	}
	return false, chunkTokenUpdate(sec)
}

// applyMessageStart seeds input/cache token counts from message_start usage.
func applyMessageStart(sec *StreamEventContext, ev anthropicStreamEvent) {
	usage := ev.Usage
	if usage == nil {
		usage = ev.Message.Usage
	}
	if usage == nil {
		return
	}
	sec.InputTokens = usage.InputTokens
	sec.CacheReadInputTokens = usage.CacheReadInputTokens
	sec.CacheCreationInputTokens = usage.CacheCreationInputTokens
}

// applyContentBlockStart flushes the previous tool and seeds a new tool_use
// accumulator, optionally with a complete input sent up front.
func applyContentBlockStart(sec *StreamEventContext, ev anthropicStreamEvent) {
	sec.FlushLastTool()
	*sec.LastToolIdx = -1
	if ev.ContentBlock.Type != "tool_use" {
		return
	}
	tc := &ToolCall{ID: ev.ContentBlock.ID, Name: ev.ContentBlock.Name}
	// Seed with a complete input when the vendor sends it up front.
	if len(ev.ContentBlock.Input) > 0 && string(ev.ContentBlock.Input) != "{}" {
		tc.Arguments = ev.ContentBlock.Input
	}
	sec.ToolAcc[ev.Index] = tc
	*sec.LastToolIdx = ev.Index
}

// applyMessageDelta applies message_delta usage and emits the final chunk on
// end_turn / max_tokens. Returns (finished, tokenUpdate).
func applyMessageDelta(sec *StreamEventContext, ev anthropicStreamEvent) (bool, *Chunk) {
	if ev.Usage != nil {
		sec.OutputTokens = ev.Usage.OutputTokens
		// message_delta usage typically carries only output_tokens; do not
		// clobber cache stats parsed from message_start when absent.
		if ev.Usage.CacheReadInputTokens > 0 {
			sec.CacheReadInputTokens = ev.Usage.CacheReadInputTokens
		}
		if ev.Usage.CacheCreationInputTokens > 0 {
			sec.CacheCreationInputTokens = ev.Usage.CacheCreationInputTokens
		}
	}
	sec.FlushLastTool()
	*sec.LastToolIdx = -1
	if ev.Delta.StopReason == "end_turn" || ev.Delta.StopReason == "max_tokens" {
		sendChunk(sec.Ctx, sec.Ch, Chunk{
			Done: true, FinishReason: ev.Delta.StopReason,
			InputTokens: sec.InputTokens, OutputTokens: sec.OutputTokens,
			CacheReadInputTokens: sec.CacheReadInputTokens, CacheCreationInputTokens: sec.CacheCreationInputTokens,
		})
		return true, nil
	}
	return false, chunkTokenUpdate(*sec)
}

// chunkTokenUpdate reports the running token counts so the scanner loop can
// carry them across events.
func chunkTokenUpdate(sec StreamEventContext) *Chunk {
	return &Chunk{
		InputTokens: sec.InputTokens, OutputTokens: sec.OutputTokens,
		CacheReadInputTokens: sec.CacheReadInputTokens, CacheCreationInputTokens: sec.CacheCreationInputTokens,
	}
}

func handleContentBlockDelta(sec StreamEventContext, ev anthropicStreamEvent) bool {
	switch ev.Delta.Type {
	case "text_delta":
		if ev.Delta.Text != "" {
			select {
			case <-sec.Ctx.Done():
				return true
			case sec.Ch <- Chunk{TextDelta: ev.Delta.Text}:
			}
		}
	case "thinking_delta":
		if ev.Delta.Thinking != "" {
			select {
			case <-sec.Ctx.Done():
				return true
			case sec.Ch <- Chunk{ReasoningDelta: ev.Delta.Thinking}:
			}
		}
	case "input_json_delta":
		if acc := sec.ToolAcc[ev.Index]; acc != nil {
			acc.Arguments = append(acc.Arguments, []byte(ev.Delta.PartialJSON)...)
		}
	}
	return false
}

// sendChunk delegates to the shared SendChunk.
func sendChunk(ctx context.Context, ch chan<- Chunk, c Chunk) {
	SendChunk(ctx, ch, c)
}
