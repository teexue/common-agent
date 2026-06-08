package loop_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/scenario"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func TestRunWithMockProvider(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg)

	sc := &scenario.Scenario{
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
		Scenario: sc,
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
	builtin.RegisterAll(reg)

	sc := &scenario.Scenario{
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
		Scenario: sc,
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
	builtin.RegisterAll(reg)

	sc := &scenario.Scenario{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     5,
		ToolExecution: &scenario.ToolExecution{Mode: "serial", MaxParallel: 1},
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
		Scenario: sc,
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
	builtin.RegisterAll(reg)

	sc := &scenario.Scenario{
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
		Scenario: sc,
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
	builtin.RegisterAll(reg)

	sc := &scenario.Scenario{
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
		Scenario: sc,
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
	builtin.RegisterAll(reg)

	sc := &scenario.Scenario{
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
		Scenario: sc,
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
	builtin.RegisterAll(reg)

	sc := &scenario.Scenario{
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
		Scenario: sc,
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
