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

func TestRunApproval_Approved(t *testing.T) {
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
			if out["status"] != "user_rejected" {
				t.Fatalf("expected user_rejected status, got %s", ev.Output)
			}
			if !strings.Contains(out["message"], "user declined") {
				t.Fatalf("expected user-declined message, got %s", ev.Output)
			}
			if _, hasErr := out["error"]; hasErr {
				t.Fatalf("denial must not use error (looks like a tool failure): %s", ev.Output)
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
