package loop_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func TestRunContextCancellation(t *testing.T) {
	reg := registry.New()
	builtin.RegisterAll(reg, t.TempDir())
	reg.MustRegister(echoTool{})

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
