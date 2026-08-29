package loop_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tool"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

// echoTool is a test-local stub standing in for the removed builtin echo tool.
type echoTool struct{}

func (echoTool) Name() string        { return "echo" }
func (echoTool) Description() string { return "test echo tool" }
func (echoTool) InputSchema() map[string]any {
	return map[string]any{"type": "object", "properties": map[string]any{}}
}
func (echoTool) Execute(_ context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Message string `json:"message"`
	}
	_ = json.Unmarshal(input, &args)
	out, _ := json.Marshal(map[string]string{"message": args.Message})
	return tool.Result{Output: out}, nil
}

func TestRunWithMockProvider(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())
	reg.MustRegister(echoTool{})

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
	reg.MustRegister(echoTool{})

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
	reg.MustRegister(echoTool{})

	sc := &agent.Agent{
		Name:          "test",
		Provider:      "mock",
		SystemPrompt:  "test",
		Tools:         []string{"echo"},
		Model:         "mock",
		MaxTurns:      5,
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
	reg.MustRegister(echoTool{})

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
	require.NoError(t, err)

	sawMaxTurns := false
	for ev := range events {
		if ev.Type == event.TypeError && ev.Code == "max_turns" {
			sawMaxTurns = true
		}
	}
	assert.True(t, sawMaxTurns, "expected max_turns error")
}

func TestRunMaxTurnsUnlimitedContinues(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())
	reg.MustRegister(echoTool{})

	sc := &agent.Agent{
		Name:         "test",
		Provider:     "mock",
		SystemPrompt: "test",
		Tools:        []string{"echo"},
		Model:        "mock",
		MaxTurns:     0, // unlimited
	}

	args, _ := json.Marshal(map[string]string{"message": "x"})
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{ToolCalls: []provider.ToolCall{{ID: "1", Name: "echo", Arguments: args}}}},
			{{ToolCalls: []provider.ToolCall{{ID: "2", Name: "echo", Arguments: args}}}},
			{{Text: "done after tools"}},
		},
	}

	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock,
		Registry: reg,
		Agent:    sc,
		Session:  session.New(sc.Name),
		Prompt:   "x",
	})
	require.NoError(t, err)

	var sawDone, sawMaxTurns bool
	var toolResults int
	for ev := range events {
		if ev.Type == event.TypeToolResult {
			toolResults++
		}
		if ev.Type == event.TypeError && ev.Code == "max_turns" {
			sawMaxTurns = true
		}
		if ev.Type == event.TypeDone && ev.Status == "completed" {
			sawDone = true
		}
	}
	assert.False(t, sawMaxTurns)
	assert.True(t, sawDone)
	assert.Equal(t, 2, toolResults)
}

func TestRunTextOnlyResponse(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())
	reg.MustRegister(echoTool{})

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
	reg.MustRegister(echoTool{})

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
