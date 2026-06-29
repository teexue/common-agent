// Package subagent provides sub-agent delegation capabilities.
// A parent agent can delegate tasks to child agents via the delegate_task tool.
// Child agents inherit the parent's policy and registry, but can have their
// own agent configuration (system prompt, model, tools, max_turns).
package subagent

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
)

const (
	// DefaultMaxDepth is the default maximum nesting depth for sub-agents.
	DefaultMaxDepth = 3
)

// Config configures a sub-agent run.
type Config struct {
	// AgentName is the name of the agent YAML to load for the sub-agent.
	// If empty, uses the parent agent's config.
	AgentName string

	// Task is the prompt/task for the sub-agent.
	Task string

	// Context is optional additional context provided to the sub-agent.
	Context string

	// MaxTurns overrides the sub-agent's max_turns (0 = use agent default).
	MaxTurns int

	// Timeout overrides the sub-agent's timeout (0 = inherit parent context).
	Timeout int // seconds

	// Depth is the current nesting depth (0 = top-level).
	Depth int
}

// Deps provides the dependencies a sub-agent needs from its parent.
type Deps struct {
	AgentsDir   string
	Registry    loop.ToolRegistry
	NewProvider func(a *agent.Agent) (provider.Provider, error)
	Logger      *slog.Logger
	Policy      permission.Policy
	Approver    loop.Approver
}

// Result is the outcome of a sub-agent run.
type Result struct {
	// Response is the final text response from the sub-agent.
	Response string
	// Events are all events emitted during the sub-agent run.
	Events []event.Event
	// Turns is the number of turns the sub-agent used.
	Turns int
	// Status is the completion status.
	Status string
}

// Run executes a sub-agent and returns the result.
// It emits TypeSubAgentStart and TypeSubAgentEnd events on the parent's event channel.
func Run(ctx context.Context, cfg Config, deps Deps, parentOut chan<- event.Event) (*Result, error) {
	if cfg.Depth >= DefaultMaxDepth {
		return nil, fmt.Errorf("sub-agent depth limit exceeded (%d)", DefaultMaxDepth)
	}

	a, err := loadSubAgent(deps.AgentsDir, cfg)
	if err != nil {
		return nil, err
	}

	p, err := deps.NewProvider(a)
	if err != nil {
		return nil, fmt.Errorf("create provider for sub-agent: %w", err)
	}

	prompt := cfg.Task
	if cfg.Context != "" {
		prompt = cfg.Context + "\n\n" + cfg.Task
	}

	loopCfg := loop.Config{
		Provider: p, Registry: deps.Registry, Agent: a,
		Session: session.New(a.Name), Prompt: prompt,
		Logger: deps.Logger, Policy: deps.Policy, Approver: deps.Approver,
	}

	emitEvent(ctx, parentOut, event.Event{Type: event.TypeSubAgentStart, Tool: a.Name, Content: cfg.Task})

	events, err := loop.Run(ctx, loopCfg)
	if err != nil {
		emitEvent(ctx, parentOut, event.Event{Type: event.TypeSubAgentEnd, Tool: a.Name, Content: fmt.Sprintf("error: %v", err)})
		return nil, fmt.Errorf("run sub-agent: %w", err)
	}

	result := collectResult(events)

	emitEvent(ctx, parentOut, event.Event{Type: event.TypeSubAgentEnd, Tool: a.Name, Content: result.Response})
	return result, nil
}

// loadSubAgent loads or creates a sub-agent configuration.
func loadSubAgent(agentsDir string, cfg Config) (*agent.Agent, error) {
	if cfg.AgentName != "" {
		a, err := agent.LoadByName(agentsDir, cfg.AgentName)
		if err != nil {
			return nil, fmt.Errorf("load sub-agent %q: %w", cfg.AgentName, err)
		}
		if cfg.MaxTurns > 0 {
			a.MaxTurns = cfg.MaxTurns
		}
		return a, nil
	}
	a := &agent.Agent{
		Name: "sub-agent", Provider: "default",
		SystemPrompt: "You are a helpful sub-agent. Complete the assigned task.",
		Tools: []string{}, MaxTurns: 5, MaxTokens: 4096,
	}
	if cfg.MaxTurns > 0 {
		a.MaxTurns = cfg.MaxTurns
	}
	return a, nil
}

// collectResult drains the event channel and builds the sub-agent result.
func collectResult(events <-chan event.Event) *Result {
	result := &Result{}
	var lastText string
	for ev := range events {
		result.Events = append(result.Events, ev)
		switch ev.Type {
		case event.TypeTextDelta:
			lastText += ev.Content
		case event.TypeDone:
			result.Turns = ev.Turns
			result.Status = ev.Status
		case event.TypeError:
			result.Status = "failed"
		}
	}
	result.Response = lastText
	return result
}

func emitEvent(ctx context.Context, out chan<- event.Event, ev event.Event) {
	select {
	case <-ctx.Done():
	case out <- ev:
	default:
		// Non-blocking: if parent channel is full, skip.
	}
}
