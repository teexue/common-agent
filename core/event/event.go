package event

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
)

// Type identifies an agent stream event.
type Type string

const (
	// TypeTextDelta streams a token of assistant reply text. Clients concatenate
	// Content across these events to rebuild the visible answer.
	TypeTextDelta Type = "text_delta"
	// TypeReasoningDelta streams a token of model thinking, kept separate from
	// reply text so UIs can render a collapsible reasoning pane.
	TypeReasoningDelta Type = "reasoning_delta"
	// TypeToolStart signals a tool invocation is about to run (name, call id,
	// JSON input) so UIs can show an in-progress card.
	TypeToolStart Type = "tool_start"
	// TypeToolResult delivers a completed tool call's JSON output so UIs can
	// close the in-progress card and the loop can continue.
	TypeToolResult Type = "tool_result"
	// TypeToolApproval pauses the loop until a human approves or denies a
	// gated tool; ApprovalID is the handle the client must POST back.
	TypeToolApproval Type = "tool_approval_required"
	// TypeCompaction notifies consumers that session history was compacted
	// mid-run so token-usage UIs can refresh rather than treating it as a reply.
	TypeCompaction Type = "compaction"
	// TypeSubAgentStart announces a nested agent run (Tool holds the sub-agent
	// id) so UIs can nest the subsequent event stream.
	TypeSubAgentStart Type = "sub_agent_start"
	// TypeSubAgentEnd closes the nested run opened by TypeSubAgentStart.
	TypeSubAgentEnd Type = "sub_agent_end"
	// TypeError reports a fatal stream failure (Code + Message).
	TypeError Type = "error"
	// TypeDone is the terminal event of a run; it carries status, turn count,
	// and token usage. StreamEvents stops after emitting it.
	TypeDone Type = "done"
)

// AllTypes is every stream event type. Adding a Type constant requires
// appending it here so consumer contract tests fail until they handle it.
func AllTypes() []Type {
	return []Type{
		TypeTextDelta,
		TypeReasoningDelta,
		TypeToolStart,
		TypeToolResult,
		TypeToolApproval,
		TypeCompaction,
		TypeSubAgentStart,
		TypeSubAgentEnd,
		TypeError,
		TypeDone,
	}
}

// Event is the unified outward-facing agent event.
type Event struct {
	Type Type `json:"type"`

	// text_delta / reasoning_delta
	Content string `json:"content,omitempty"`

	// tool_start / tool_result / tool_approval_required
	Tool       string          `json:"tool,omitempty"`
	Input      json.RawMessage `json:"input,omitempty"`
	ToolCallID string          `json:"tool_call_id,omitempty"`

	// tool_approval_required
	ApprovalID string `json:"approval_id,omitempty"`

	// tool_result
	Output json.RawMessage `json:"output,omitempty"`

	// error
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`

	// done
	Status        string `json:"status,omitempty"`
	Turns         int    `json:"turns,omitempty"`
	InputTokens   int    `json:"input_tokens,omitempty"`
	OutputTokens  int    `json:"output_tokens,omitempty"`
	ContextWindow int    `json:"context_window,omitempty"`
	SessionID     string `json:"session_id,omitempty"`

	// done — prompt cache usage across the run (0 when providers do not report it).
	CacheReadInputTokens     int `json:"cache_read_input_tokens,omitempty"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens,omitempty"`

	// done — cumulative token usage across every turn of the run (all turns
	// combined, unlike the per-turn Input/OutputTokens above).
	TotalInputTokens  int `json:"total_input_tokens,omitempty"`
	TotalOutputTokens int `json:"total_output_tokens,omitempty"`
}

// StreamEvents writes JSON-line events to w until done or ctx cancelled.
func StreamEvents(ctx context.Context, w io.Writer, events <-chan Event) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case ev, ok := <-events:
			if !ok {
				return nil
			}
			data, err := json.Marshal(ev)
			if err != nil {
				return err
			}
			if _, err := fmt.Fprintf(w, "%s\n", data); err != nil {
				return err
			}
			if ev.Type == TypeDone {
				return nil
			}
		}
	}
}

// PrintEvents prints human-readable events to stdout.
// Deprecated: use tui.PrintEvents for Claude Code–style output.
func PrintEvents(events <-chan Event) {
	for ev := range events {
		switch ev.Type {
		case TypeTextDelta, TypeReasoningDelta:
			fmt.Print(ev.Content)
		case TypeToolStart:
			fmt.Printf("\n⏺ %s(%s)\n", ev.Tool, string(ev.Input))
		case TypeToolResult:
			fmt.Printf("  ⎿ %s\n", string(ev.Output))
		case TypeToolApproval:
			fmt.Printf("\n⏸ %s approval_id=%s\n", ev.Tool, ev.ApprovalID)
		case TypeCompaction:
			fmt.Printf("\n⟳ %s\n", ev.Content)
		case TypeSubAgentStart:
			fmt.Printf("\n↳ Sub-agent %s: %s\n", ev.Tool, ev.Content)
		case TypeSubAgentEnd:
			fmt.Printf("↲ Sub-agent %s done\n", ev.Tool)
		case TypeError:
			fmt.Printf("\n✗ %s: %s\n", ev.Code, ev.Message)
		case TypeDone:
			// quiet
		}
	}
}
