// Package subagent provides sub-agent delegation capabilities.
// A parent agent can delegate tasks to child agents via the delegate_task tool.
// Child agents inherit the parent's policy and registry, but can have their
// own agent configuration (system prompt, model, tools, max_turns).
package subagent

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
)

const (
	// DefaultMaxDepth is the deepest child run allowed (1 = main agent only).
	DefaultMaxDepth = 1
)

// Config configures a sub-agent run.
type Config struct {
	// AgentName is the name of the agent YAML to load for the sub-agent.
	// If empty, inherits the parent agent's config.
	AgentName string
	// Task is the prompt/task for the sub-agent.
	Task string
	// Context is optional additional context provided to the sub-agent.
	Context string
	// MaxTurns overrides the sub-agent's max_turns (0 = use agent default).
	MaxTurns int
	// Timeout is unused; global Limits.Timeout applies instead.
	Timeout int // seconds
	// Depth is this child run's nesting level (1 = spawned by the main agent).
	Depth int
	// Limits are process-wide caps from global settings.
	Limits loop.SubagentLimits
}

// Deps provides the dependencies a sub-agent needs from its parent.
type Deps struct {
	AgentsDir       string
	Registry        loop.ToolRegistry
	NewProvider     func(a *agent.Agent) (provider.Provider, error)
	Logger          *slog.Logger
	Policy          permission.Policy
	Approver        loop.Approver
	Store           session.Store
	WorkDir         string
	UserID          string
	ParentSessionID string
	ParentAgent     *agent.Agent
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
	// SessionID is the persisted child session, when a store is configured.
	SessionID string
}

// Run executes a sub-agent and returns the result.
// It emits TypeSubAgentStart and TypeSubAgentEnd events on the parent's event channel.
func Run(ctx context.Context, cfg Config, deps Deps, parentOut chan<- event.Event) (*Result, error) {
	var limits loop.SubagentLimits
	if cfg.Limits == (loop.SubagentLimits{}) {
		limits = loop.SubagentLimits{Enabled: true, MaxTurns: 5, MaxDepth: DefaultMaxDepth}
	} else {
		limits = loop.NormalizeSubagentLimits(cfg.Limits)
	}
	cfg.Limits = limits
	if cfg.Depth > limits.MaxDepth {
		return nil, fmt.Errorf("sub-agent depth limit exceeded (%d)", limits.MaxDepth)
	}
	if limits.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(limits.Timeout)*time.Second)
		defer cancel()
	}
	a, err := loadSubAgent(deps, cfg, limits)
	if err != nil {
		return nil, err
	}
	p, err := deps.NewProvider(a)
	if err != nil {
		return nil, fmt.Errorf("create provider for sub-agent: %w", err)
	}
	sess := newChildSession(cfg, deps, a)
	loopCfg := childLoopConfig(cfg, deps, a, p, sess)
	emitEvent(ctx, parentOut, event.Event{
		Type: event.TypeSubAgentStart, Tool: a.Name, Content: cfg.Task, SessionID: sess.ID,
	})
	events, err := loop.Run(ctx, loopCfg)
	if err != nil {
		emitEvent(ctx, parentOut, event.Event{
			Type: event.TypeSubAgentEnd, Tool: a.Name, Content: fmt.Sprintf("error: %v", err), SessionID: sess.ID,
		})
		return nil, fmt.Errorf("run sub-agent: %w", err)
	}
	result := collectResult(events)
	result.SessionID = sess.ID
	emitEvent(ctx, parentOut, event.Event{
		Type: event.TypeSubAgentEnd, Tool: a.Name, Content: result.Response, SessionID: sess.ID,
	})
	return result, nil
}

func childLoopConfig(cfg Config, deps Deps, a *agent.Agent, p provider.Provider, sess *session.Session) loop.Config {
	prompt := cfg.Task
	if cfg.Context != "" {
		prompt = cfg.Context + "\n\n" + cfg.Task
	}
	return loop.Config{
		Provider: p, Registry: deps.Registry, Agent: a,
		Session: sess, Prompt: prompt,
		Logger: deps.Logger, Policy: deps.Policy, Approver: deps.Approver,
		Store: deps.Store, WorkDir: deps.WorkDir,
		AgentsDir: deps.AgentsDir, NewProvider: deps.NewProvider,
		Depth: cfg.Depth, Source: "subagent", Subagent: cfg.Limits,
	}
}

func newChildSession(cfg Config, deps Deps, a *agent.Agent) *session.Session {
	sess := session.NewForUser(a.ID, deps.UserID)
	sess.EnsureTitle(cfg.Task)
	sess.SetMetadata(session.MetadataKeySource, session.SourceSubagent)
	if deps.ParentSessionID != "" {
		sess.SetMetadata(session.MetadataKeyParentSession, deps.ParentSessionID)
	}
	if deps.WorkDir != "" {
		sess.SetMetadata(session.MetadataKeyWorkdir, deps.WorkDir)
	}
	return sess
}

func loadSubAgent(deps Deps, cfg Config, limits loop.SubagentLimits) (*agent.Agent, error) {
	var a *agent.Agent
	if cfg.AgentName != "" {
		loaded, err := agent.LoadByName(deps.AgentsDir, cfg.AgentName)
		if err != nil {
			return nil, fmt.Errorf("load sub-agent %q: %w", cfg.AgentName, err)
		}
		a = loaded
	} else {
		a = inheritOrDefault(deps.ParentAgent)
	}
	a.MaxTurns = limits.MaxTurns
	canDelegate := limits.Enabled && cfg.Depth < limits.MaxDepth
	if _, ok := deps.Registry.Get(ToolName); ok {
		ApplyToAgent(a, canDelegate)
	} else if !canDelegate {
		a.Tools = withoutName(a.Tools, ToolName)
	}
	return a, nil
}

func inheritOrDefault(parent *agent.Agent) *agent.Agent {
	if parent == nil {
		return &agent.Agent{
			Name: "sub-agent", Provider: "default",
			SystemPrompt: "You are a helpful sub-agent. Complete the assigned task.",
			Tools:        []string{}, MaxTurns: 5, MaxTokens: 4096,
		}
	}
	clone := *parent
	if parent.Tools != nil {
		clone.Tools = append([]string(nil), parent.Tools...)
	}
	clone.Permissions = clonePermissions(parent.Permissions)
	return &clone
}

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
	if out == nil {
		return
	}
	select {
	case <-ctx.Done():
	case out <- ev:
	}
}
