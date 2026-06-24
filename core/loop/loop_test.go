package loop_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func TestRunWithMockProvider(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "You are a test assistant.",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     5,
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: provider.EchoThenReply("hello"),
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "echo hello",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	var text strings.Builder
	var sawToolStart, sawToolResult, sawDone bool
	for ev := range events {
		switch ev.Type {
		case event.TypeTextDelta:
			text.WriteString(ev.Content)
		case event.TypeToolStart:
			if ev.Tool != "echo" {
				t.Fatalf("unexpected tool start: %q", ev.Tool)
			}
			sawToolStart = true
		case event.TypeToolResult:
			sawToolResult = true
		case event.TypeDone:
			if ev.Status != "completed" {
				t.Fatalf("unexpected done status: %q", ev.Status)
			}
			sawDone = true
		case event.TypeError:
			t.Fatalf("unexpected error: %s", ev.Message)
		}
	}

	if !sawToolStart || !sawToolResult || !sawDone {
		t.Fatalf("missing events: start=%v result=%v done=%v", sawToolStart, sawToolResult, sawDone)
	}
	if text.Len() == 0 {
		t.Fatal("expected text output")
	}
}

func TestRunUnknownTool(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     3,
	}

	args := []byte(`{"message":"x"}`)
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{
				ToolCalls: []provider.ToolCall{{ID: "1", Name: "missing_tool", Arguments: args}},
			}},
			{{Text: "done"}},
		},
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock,
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "test",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	for ev := range events {
		if ev.Type == event.TypeToolResult && ev.Tool == "missing_tool" {
			var out map[string]string
			if err := json.Unmarshal(ev.Output, &out); err != nil || out["error"] != "tool not found" {
				t.Fatalf("unexpected tool result: %s", ev.Output)
			}
			return
		}
	}
	t.Fatal("expected tool not found result")
}

func TestRunSerialMode(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     5,
		ToolExecution: &agent.ToolExecution{Mode: "serial", MaxParallel: 1},
	}

	args, _ := json.Marshal(map[string]string{"message": "hi"})
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{
				ToolCalls: []provider.ToolCall{
					{ID: "1", Name: "echo", Arguments: args},
					{ID: "2", Name: "echo", Arguments: args},
				},
			}},
			{{Text: "done"}},
		},
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock,
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "test",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	toolResults := 0
	for ev := range events {
		if ev.Type == event.TypeToolResult {
			toolResults++
		}
	}
	if toolResults != 2 {
		t.Fatalf("got %d tool results, want 2", toolResults)
	}
}

func TestRunMaxTurnsExceeded(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     1,
	}

	args, _ := json.Marshal(map[string]string{"message": "x"})
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{ToolCalls: []provider.ToolCall{{ID: "1", Name: "echo", Arguments: args}}}},
		},
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock,
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "x",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	sawMaxTurns := false
	for ev := range events {
		if ev.Type == event.TypeError && ev.Code == "max_turns" {
			sawMaxTurns = true
		}
	}
	if !sawMaxTurns {
		t.Fatal("expected max_turns error")
	}
}

func TestRunContextCancellation(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     10,
	}

	args, _ := json.Marshal(map[string]string{"message": "x"})
	// Use a mock that blocks on the second Stream call, so the loop
	// is guaranteed to be waiting when we cancel the context.
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{ToolCalls: []provider.ToolCall{{ID: "1", Name: "echo", Arguments: args}}}},
		},
		BlockOnStream: true,
	}

	ctx, cancel := context.WithCancel(context.Background())
	events, err := loop.Run(ctx, loop.Config{
		Provider: mock,
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "x",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	// Read events until we see tool_start, meaning the loop has started
	// processing the first turn. Then wait for the loop to be blocked
	// in Stream for the second turn before cancelling.
	sawToolStart := false
	for ev := range events {
		if ev.Type == event.TypeToolStart {
			sawToolStart = true
			break
		}
	}
	if !sawToolStart {
		t.Fatal("expected tool_start event before cancellation")
	}

	// Now the loop is executing the tool and will soon be blocked in Stream.
	// Read the tool_result to ensure the first turn is fully done.
	for ev := range events {
		if ev.Type == event.TypeToolResult {
			break
		}
	}

	// Cancel — the loop should be entering turn 2's Stream call now.
	cancel()

	// Drain remaining events looking for the cancelled error.
	sawCancelled := false
	for ev := range events {
		if ev.Type == event.TypeError && ev.Code == "cancelled" {
			sawCancelled = true
		}
	}
	if !sawCancelled {
		t.Fatal("expected cancelled error event")
	}
}

func TestRunTextOnlyResponse(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     5,
	}

	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{Text: "no tools needed"}},
		},
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock,
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "hello",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	sawDone := false
	for ev := range events {
		if ev.Type == event.TypeDone && ev.Status == "completed" {
			sawDone = true
		}
	}
	if !sawDone {
		t.Fatal("expected completed done event")
	}
}

func TestRunReasoningDeltaEvents(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     5,
	}

	args, _ := json.Marshal(map[string]string{"message": "hi"})
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{
				Reasoning: "let me think about this",
				ToolCalls: []provider.ToolCall{{ID: "1", Name: "echo", Arguments: args}},
			}},
			{{Text: "done"}},
		},
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock,
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "test",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	sawReasoning := false
	for ev := range events {
		if ev.Type == event.TypeReasoningDelta {
			sawReasoning = true
		}
	}
	if !sawReasoning {
		t.Fatal("expected reasoning_delta events")
	}
}
func TestRunApproval_Approved(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     5,
	}

	args, _ := json.Marshal(map[string]string{"message": "hi"})
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{ToolCalls: []provider.ToolCall{{ID: "tc-1", Name: "echo", Arguments: args}}}},
			{{Text: "done"}},
		},
	}

	// Any tool not in auto_approve/always_deny returns Confirm.
	pol := permission.NewAgentPolicy(permission.Permissions{})

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock,
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "test",
		Policy:   pol,
		Approver: staticApprover{approve: true},
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	var sawApprovalEvent, sawResult bool
	for ev := range events {
		switch ev.Type {
		case event.TypeToolApproval:
			if ev.Tool != "echo" {
				t.Fatalf("unexpected approval tool: %q", ev.Tool)
			}
			if ev.ApprovalID != "tc-1" {
				t.Fatalf("expected approval_id tc-1, got %q", ev.ApprovalID)
			}
			if ev.ToolCallID != "tc-1" {
				t.Fatalf("expected tool_call_id tc-1, got %q", ev.ToolCallID)
			}
			sawApprovalEvent = true
		case event.TypeToolResult:
			out := string(ev.Output)
			if !strings.Contains(out, "hi") {
				t.Fatalf("expected echoed output, got %s", out)
			}
			if ev.ToolCallID != "tc-1" {
				t.Fatalf("expected tool_call_id tc-1 on result, got %q", ev.ToolCallID)
			}
			sawResult = true
		}
	}

	if !sawApprovalEvent {
		t.Fatal("expected tool_approval_required event")
	}
	if !sawResult {
		t.Fatal("expected tool result after approval")
	}
}

func TestRunApproval_Denied(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     5,
	}

	args, _ := json.Marshal(map[string]string{"message": "hi"})
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{ToolCalls: []provider.ToolCall{{ID: "tc-1", Name: "echo", Arguments: args}}}},
			{{Text: "done"}},
		},
	}

	pol := permission.NewAgentPolicy(permission.Permissions{})

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock,
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "test",
		Policy:   pol,
		Approver: staticApprover{approve: false},
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	var sawApprovalEvent, sawDeniedResult bool
	for ev := range events {
		switch ev.Type {
		case event.TypeToolApproval:
			sawApprovalEvent = true
		case event.TypeToolResult:
			out := make(map[string]string)
			_ = json.Unmarshal(ev.Output, &out)
			if out["error"] != "tool approval denied" {
				t.Fatalf("expected denial error, got %s", ev.Output)
			}
			sawDeniedResult = true
		}
	}

	if !sawApprovalEvent {
		t.Fatal("expected tool_approval_required event")
	}
	if !sawDeniedResult {
		t.Fatal("expected denied tool result")
	}
}

type staticApprover struct {
	approve bool
}

func (a staticApprover) Approve(_ context.Context, _ loop.ApprovalRequest) bool {
	return a.approve
}
