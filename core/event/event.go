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
	TypeTextDelta      Type = "text_delta"
	TypeReasoningDelta Type = "reasoning_delta"
	TypeToolStart      Type = "tool_start"
	TypeToolResult     Type = "tool_result"
	TypeToolApproval   Type = "tool_approval_required"
	TypeCompaction     Type = "compaction"
	TypeSubAgentStart  Type = "sub_agent_start"
	TypeSubAgentEnd    Type = "sub_agent_end"
	TypeError          Type = "error"
	TypeDone           Type = "done"
)

// Event is the unified outward-facing agent event.
type Event struct {
	Type Type `json:"type"`

	// text_delta / reasoning_delta
	Content string `json:"content,omitempty"`

	// tool_start / tool_result / tool_approval_required
	Tool      string          `json:"tool,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolCallID string         `json:"tool_call_id,omitempty"`

	// tool_approval_required
	ApprovalID string `json:"approval_id,omitempty"`

	// tool_result
	Output json.RawMessage `json:"output,omitempty"`

	// error
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`

	// done
	Status       string `json:"status,omitempty"`
	Turns        int    `json:"turns,omitempty"`
	InputTokens  int    `json:"input_tokens,omitempty"`
	OutputTokens int    `json:"output_tokens,omitempty"`
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
