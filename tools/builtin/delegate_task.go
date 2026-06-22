package builtin

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/subagent"
	"github.com/teexue/common-agent/core/tool"
)

// DelegateTask is a built-in tool that delegates a task to a sub-agent.
type DelegateTask struct {
	Deps subagent.Deps
	// Depth is the current nesting depth.
	Depth int
}

func (d *DelegateTask) Name() string { return "delegate_task" }
func (d *DelegateTask) Description() string {
	return "Delegate a task to a sub-agent. The sub-agent will execute the task independently and return the result."
}
func (d *DelegateTask) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"agent": map[string]any{
				"type":        "string",
				"description": "Name of the agent YAML to use for the sub-agent (optional, uses default if empty)",
			},
			"task": map[string]any{
				"type":        "string",
				"description": "The task/prompt for the sub-agent to complete",
			},
			"context": map[string]any{
				"type":        "string",
				"description": "Additional context to provide to the sub-agent (optional)",
			},
			"max_turns": map[string]any{
				"type":        "integer",
				"description": "Maximum turns for the sub-agent (optional, default 5)",
			},
		},
		"required": []string{"task"},
	}
}

func (d *DelegateTask) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Agent    string `json:"agent"`
		Task     string `json:"task"`
		Context  string `json:"context"`
		MaxTurns int    `json:"max_turns"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse delegate_task input: %w", err)
	}
	if args.Task == "" {
		return tool.Result{}, fmt.Errorf("task is required")
	}

	cfg := subagent.Config{
		AgentName: args.Agent,
		Task:      args.Task,
		Context:   args.Context,
		MaxTurns:  args.MaxTurns,
		Depth:     d.Depth + 1,
	}

	// Get the parent event channel from context (set by the loop).
	var parentOut chan<- event.Event
	if ch, ok := ctx.Value("parent_event_chan").(chan<- event.Event); ok {
		parentOut = ch
	}

	result, err := subagent.Run(ctx, cfg, d.Deps, parentOut)
	if err != nil {
		return tool.Result{}, err
	}

	out, _ := json.Marshal(map[string]any{
		"response": result.Response,
		"status":   result.Status,
		"turns":    result.Turns,
	})
	return tool.Result{Output: out}, nil
}
