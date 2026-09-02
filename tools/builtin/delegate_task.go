package builtin

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/subagent"
	"github.com/teexue/common-agent/core/tool"
)

// DelegateTask is a built-in tool that delegates a task to a sub-agent.
type DelegateTask struct{}

// Name returns the tool name.
func (DelegateTask) Name() string { return "delegate_task" }

// Description returns a human-readable description.
func (DelegateTask) Description() string {
	return "Delegate a self-contained task to a sub-agent. Call this yourself when work is parallelizable, isolated, or would clutter the main thread; do not wait for the user to request a sub-agent. Pass a complete task — the child does not share this conversation."
}

// InputSchema returns the JSON Schema for the tool's input.
func (DelegateTask) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"agent": map[string]any{
				"type":        "string",
				"description": "Name of the agent YAML to use for the sub-agent (optional, inherits the parent if empty)",
			},
			"task": map[string]any{
				"type":        "string",
				"description": "The task/prompt for the sub-agent to complete",
			},
			"context": map[string]any{
				"type":        "string",
				"description": "Additional context to provide to the sub-agent (optional)",
			},
		},
		"required": []string{"task"},
	}
}

// Execute runs the tool.
func (DelegateTask) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Agent   string `json:"agent"`
		Task    string `json:"task"`
		Context string `json:"context"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse delegate_task input: %w", err)
	}
	if args.Task == "" {
		return tool.Result{}, fmt.Errorf("task is required")
	}
	spawn, ok := loop.SpawnFrom(ctx)
	if !ok || spawn.NewProvider == nil {
		return tool.Result{}, fmt.Errorf("sub-agent spawning is not configured")
	}
	if !spawn.Subagent.Enabled && spawn.Subagent != (loop.SubagentLimits{}) {
		return tool.Result{}, fmt.Errorf("sub-agent is disabled")
	}
	result, err := subagent.Run(ctx, subagent.Config{
		AgentName: args.Agent,
		Task:      args.Task,
		Context:   args.Context,
		Depth:     spawn.Depth + 1,
		Limits:    spawn.Subagent,
	}, spawnDeps(spawn), loop.GetParentEventChan(ctx))
	if err != nil {
		return tool.Result{}, err
	}
	out, _ := json.Marshal(map[string]any{
		"response":   result.Response,
		"status":     result.Status,
		"turns":      result.Turns,
		"session_id": result.SessionID,
	})
	return tool.Result{Output: out}, nil
}

func spawnDeps(spawn loop.Spawn) subagent.Deps {
	return subagent.Deps{
		AgentsDir:       spawn.AgentsDir,
		Registry:        spawn.Registry,
		NewProvider:     spawn.NewProvider,
		Logger:          spawn.Logger,
		Policy:          spawn.Policy,
		Approver:        spawn.Approver,
		Store:           spawn.Store,
		WorkDir:         spawn.WorkDir,
		Shell:           spawn.Shell,
		UserID:          spawn.UserID,
		ParentSessionID: spawn.SessionID,
		ParentAgent:     spawn.Agent,
	}
}
