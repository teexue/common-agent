package subagent

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/tool"
	"github.com/teexue/common-agent/tools/registry"
)

type testTool struct {
	name string
}

func (t *testTool) Name() string       { return t.name }
func (t *testTool) Description() string { return "test tool" }
func (t *testTool) InputSchema() map[string]any {
	return map[string]any{"type": "object", "properties": map[string]any{}}
}
func (t *testTool) Execute(_ context.Context, _ json.RawMessage) (tool.Result, error) {
	return tool.Result{Output: json.RawMessage(`"ok"`)}, nil
}

func setupDeps() Deps {
	reg := registry.New()
	reg.MustRegister(&testTool{name: "echo"})

	return Deps{
		AgentsDir: "/tmp/nonexistent-agents",
		Registry:  reg,
		NewProvider: func(a *agent.Agent) (provider.Provider, error) {
			return &provider.MockProvider{
				Calls: [][]provider.MockStep{
					{{Text: "sub-agent response"}},
				},
			}, nil
		},
		Policy: permission.AllowAllPolicy{},
	}
}

func TestRun_BasicExecution(t *testing.T) {
	deps := setupDeps()
	ctx := context.Background()
	out := make(chan event.Event, 100)

	result, err := Run(ctx, Config{
		Task:  "do something",
		Depth: 0,
	}, deps, out)
	if err != nil {
		t.Fatal(err)
	}

	if result.Response != "sub-agent response" {
		t.Errorf("expected 'sub-agent response', got %q", result.Response)
	}
	if result.Status != "completed" {
		t.Errorf("expected status 'completed', got %q", result.Status)
	}
}

func TestRun_EmitsSubAgentEvents(t *testing.T) {
	deps := setupDeps()
	ctx := context.Background()
	out := make(chan event.Event, 100)

	_, err := Run(ctx, Config{
		Task:  "do something",
		Depth: 0,
	}, deps, out)
	if err != nil {
		t.Fatal(err)
	}

	// Drain the channel and check for sub-agent events.
	close(out)
	var hasStart, hasEnd bool
	for ev := range out {
		if ev.Type == event.TypeSubAgentStart {
			hasStart = true
		}
		if ev.Type == event.TypeSubAgentEnd {
			hasEnd = true
		}
	}

	if !hasStart {
		t.Error("expected TypeSubAgentStart event")
	}
	if !hasEnd {
		t.Error("expected TypeSubAgentEnd event")
	}
}

func TestRun_DepthLimitExceeded(t *testing.T) {
	deps := setupDeps()
	ctx := context.Background()
	out := make(chan event.Event, 100)

	_, err := Run(ctx, Config{
		Task:  "do something",
		Depth: DefaultMaxDepth, // at the limit
	}, deps, out)
	if err == nil {
		t.Fatal("expected depth limit error")
	}
}

func TestRun_WithContext(t *testing.T) {
	deps := setupDeps()
	ctx := context.Background()
	out := make(chan event.Event, 100)

	result, err := Run(ctx, Config{
		Task:    "summarize",
		Context: "Here is the data to summarize",
		Depth:   0,
	}, deps, out)
	if err != nil {
		t.Fatal(err)
	}

	if result.Response == "" {
		t.Error("expected non-empty response")
	}
}

func TestRun_WithMaxTurns(t *testing.T) {
	deps := setupDeps()
	ctx := context.Background()
	out := make(chan event.Event, 100)

	result, err := Run(ctx, Config{
		Task:     "do something",
		MaxTurns: 3,
		Depth:    0,
	}, deps, out)
	if err != nil {
		t.Fatal(err)
	}

	if result.Turns > 3 {
		t.Errorf("expected at most 3 turns, got %d", result.Turns)
	}
}

func TestRun_WithAgentName_NotFound(t *testing.T) {
	deps := setupDeps()
	ctx := context.Background()
	out := make(chan event.Event, 100)

	_, err := Run(ctx, Config{
		AgentName: "nonexistent",
		Task:      "do something",
		Depth:     0,
	}, deps, out)
	if err == nil {
		t.Fatal("expected error for nonexistent agent")
	}
}

func TestRun_CancelledContext(t *testing.T) {
	deps := setupDeps()
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately
	out := make(chan event.Event, 100)

	// Should still complete (mock provider doesn't respect context cancellation).
	_, err := Run(ctx, Config{
		Task:  "do something",
		Depth: 0,
	}, deps, out)
	// May or may not error depending on timing, but should not panic.
	_ = err
}
