package hook_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/teexue/common-agent/core/hook"
)

// recordingHook records calls for verification.
type recordingHook struct {
	hook.BaseHook
	calls []string
}

func (r *recordingHook) OnToolStart(_ context.Context, info hook.ToolStartInfo) error {
	r.calls = append(r.calls, "start:"+info.Name)
	return nil
}

func (r *recordingHook) OnToolResult(_ context.Context, info hook.ToolResultInfo) error {
	r.calls = append(r.calls, "result:"+info.Name)
	return nil
}

func (r *recordingHook) OnTurnStart(_ context.Context, info hook.TurnInfo) error {
	r.calls = append(r.calls, "turn_start")
	return nil
}

func (r *recordingHook) OnTurnEnd(_ context.Context, info hook.TurnInfo) error {
	r.calls = append(r.calls, "turn_end")
	return nil
}

func TestChain_Order(t *testing.T) {
	r1 := &recordingHook{}
	r2 := &recordingHook{}
	chain := hook.NewChain(r1, r2)

	ctx := context.Background()
	chain.OnTurnStart(ctx, hook.TurnInfo{TurnNumber: 1})
	chain.OnToolStart(ctx, hook.ToolStartInfo{Name: "echo", Arguments: json.RawMessage(`{}`)})
	chain.OnToolResult(ctx, hook.ToolResultInfo{Name: "echo", Output: json.RawMessage(`"ok"`)})
	chain.OnTurnEnd(ctx, hook.TurnInfo{TurnNumber: 1})

	expected := []string{"turn_start", "start:echo", "result:echo", "turn_end"}
	for _, h := range []*recordingHook{r1, r2} {
		if len(h.calls) != len(expected) {
			t.Fatalf("got %d calls, want %d", len(h.calls), len(expected))
		}
		for i, want := range expected {
			if h.calls[i] != want {
				t.Fatalf("call[%d] = %q, want %q", i, h.calls[i], want)
			}
		}
	}
}

// errorHook returns an error on a specific method.
type errorHook struct {
	hook.BaseHook
	errOn string
}

func (e *errorHook) OnToolStart(_ context.Context, info hook.ToolStartInfo) error {
	if e.errOn == "start" {
		return errors.New("hook error")
	}
	return nil
}

func (e *errorHook) OnToolResult(_ context.Context, info hook.ToolResultInfo) error {
	if e.errOn == "result" {
		return errors.New("hook error")
	}
	return nil
}

func (e *errorHook) OnTurnStart(_ context.Context, info hook.TurnInfo) error {
	if e.errOn == "turn_start" {
		return errors.New("hook error")
	}
	return nil
}

func (e *errorHook) OnTurnEnd(_ context.Context, info hook.TurnInfo) error {
	if e.errOn == "turn_end" {
		return errors.New("hook error")
	}
	return nil
}

func TestChain_ErrorAbortsChain(t *testing.T) {
	errHook := &errorHook{errOn: "start"}
	r := &recordingHook{}
	chain := hook.NewChain(errHook, r)

	ctx := context.Background()
	err := chain.OnToolStart(ctx, hook.ToolStartInfo{Name: "echo"})
	if err == nil {
		t.Fatal("expected error from chain")
	}
	// Second hook should not have been called.
	if len(r.calls) != 0 {
		t.Fatalf("second hook should not have been called, got %d calls", len(r.calls))
	}
}

func TestChain_NilSafe(t *testing.T) {
	chain := hook.NewChain()
	ctx := context.Background()

	// All methods should be no-ops on empty chain.
	if err := chain.OnToolStart(ctx, hook.ToolStartInfo{}); err != nil {
		t.Fatalf("OnToolStart: %v", err)
	}
	if err := chain.OnToolResult(ctx, hook.ToolResultInfo{}); err != nil {
		t.Fatalf("OnToolResult: %v", err)
	}
	if err := chain.OnTurnStart(ctx, hook.TurnInfo{}); err != nil {
		t.Fatalf("OnTurnStart: %v", err)
	}
	if err := chain.OnTurnEnd(ctx, hook.TurnInfo{}); err != nil {
		t.Fatalf("OnTurnEnd: %v", err)
	}
}
