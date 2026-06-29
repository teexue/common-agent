// Package hook defines lifecycle hooks for the agent loop.
// Hooks are called at key points during tool execution and turn processing.
package hook

import (
	"context"
	"encoding/json"
)

// ToolStartInfo contains information about a tool call about to execute.
type ToolStartInfo struct {
	Name      string
	Arguments json.RawMessage
}

// ToolResultInfo contains information about a completed tool execution.
type ToolResultInfo struct {
	Name   string
	Output json.RawMessage
	Error  error
}

// TurnInfo contains information about a turn.
type TurnInfo struct {
	TurnNumber int
}

// Hook is the interface for agent loop lifecycle hooks.
// Implementations must be safe for concurrent use.
type Hook interface {
	// OnToolStart is called before a tool executes.
	// Returning a non-nil error aborts the tool execution.
	OnToolStart(ctx context.Context, info ToolStartInfo) error

	// OnToolResult is called after a tool executes (whether it succeeded or failed).
	OnToolResult(ctx context.Context, info ToolResultInfo) error

	// OnTurnStart is called at the beginning of each agent turn.
	OnTurnStart(ctx context.Context, info TurnInfo) error

	// OnTurnEnd is called at the end of each agent turn.
	OnTurnEnd(ctx context.Context, info TurnInfo) error
}

// BaseHook provides a no-op implementation of Hook that can be embedded
// in concrete hooks to avoid implementing all methods.
type BaseHook struct{}

// OnToolStart is a no-op implementation of Hook.OnToolStart.
func (BaseHook) OnToolStart(_ context.Context, _ ToolStartInfo) error { return nil }

// OnToolResult is a no-op implementation of Hook.OnToolResult.
func (BaseHook) OnToolResult(_ context.Context, _ ToolResultInfo) error { return nil }

// OnTurnStart is a no-op implementation of Hook.OnTurnStart.
func (BaseHook) OnTurnStart(_ context.Context, _ TurnInfo) error { return nil }

// OnTurnEnd is a no-op implementation of Hook.OnTurnEnd.
func (BaseHook) OnTurnEnd(_ context.Context, _ TurnInfo) error { return nil }
