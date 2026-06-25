package loop

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/compaction"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/hook"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/telemetry"
	"github.com/teexue/common-agent/core/tool"
)

// ToolRegistry resolves tools by name.
type ToolRegistry interface {
	Get(name string) (tool.Tool, bool)
	Definitions(names []string) ([]provider.ToolDefinition, error)
}

// Config configures a single agent run.
// workDirCtxKey is the context key for the working directory.
// Shared with tools/builtin via the same string value.
const workDirCtxKey = "workdir"

type Config struct {
	Provider provider.Provider
	Registry ToolRegistry
	Agent    *agent.Agent
	Session  *session.Session
	Prompt   string
	Logger   *slog.Logger

	// Store is an optional session persistence backend.
	// When set alongside SessionID, the loop loads the existing session
	// from the store at the start and saves it after each run.
	Store session.Store

	// SessionID, when set with Store, resumes an existing session.
	// When empty, a new session is created and its ID is stored after the run.
	SessionID string

	// Policy controls tool execution permissions.
	// When nil, all tools are allowed (AllowAllPolicy).
	Policy permission.Policy

	// Hooks are lifecycle callbacks invoked around tool execution and turns.
	// When nil, no hooks are called.
	Hooks *hook.Chain

	// Approver handles interactive tool approval when Policy returns Confirm.
	// When nil, DenyAllApprover is used (tools requiring approval are denied).
	Approver Approver

	// WorkDir overrides the working directory for file operation tools.
	// When empty, tools use their registered default.
	WorkDir string

	// Telemetry for OpenTelemetry tracing and metrics. Optional.
	Telemetry *telemetry.Telemetry
}

// GetWorkDir returns the working directory from context, or empty string.
func GetWorkDir(ctx context.Context) string {
	if v, ok := ctx.Value(workDirCtxKey).(string); ok {
		return v
	}
	return ""
}

// Run executes the agent loop and streams events.
func Run(ctx context.Context, cfg Config) (<-chan event.Event, error) {
	if cfg.Provider == nil {
		return nil, fmt.Errorf("provider is required")
	}
	if cfg.Registry == nil {
		return nil, fmt.Errorf("registry is required")
	}
	if cfg.Agent == nil {
		return nil, fmt.Errorf("agent is required")
	}
	if cfg.Session == nil {
		return nil, fmt.Errorf("session is required")
	}

	// If a Store and SessionID are provided, load the existing session.
	if cfg.Store != nil && cfg.SessionID != "" {
		loaded, err := cfg.Store.Load(cfg.SessionID)
		if err != nil {
			return nil, fmt.Errorf("load session %s: %w", cfg.SessionID, err)
		}
		cfg.Session = loaded
	}

	if cfg.Prompt == "" && len(cfg.Session.GetMessages()) == 0 {
		return nil, fmt.Errorf("prompt is required for a new session")
	}

	toolDefs, err := cfg.Registry.Definitions(cfg.Agent.Tools)
	if err != nil {
		return nil, err
	}

	msgs := cfg.Session.GetMessages()
	if len(msgs) == 0 {
		msgs = []provider.Message{
			{Role: provider.RoleSystem, Content: cfg.Agent.SystemPrompt},
		}
		cfg.Session.SetMessages(msgs)
	}
	if cfg.Prompt != "" {
		cfg.Session.AddMessages(provider.Message{
			Role:    provider.RoleUser,
			Content: cfg.Prompt,
		})
	}

	// Inject WorkDir into context for tools to read.
	if cfg.WorkDir != "" {
		ctx = context.WithValue(ctx, workDirCtxKey, cfg.WorkDir)
	}

	out := make(chan event.Event)
	go func() {
		defer close(out)
		runLoop(ctx, cfg, toolDefs, out)

		// Persist session after run completes.
		if cfg.Store != nil {
			if err := cfg.Store.Save(cfg.Session); err != nil {
				slog.Warn("failed to persist session", "session_id", cfg.Session.ID, "error", err)
			}
		}
	}()
	return out, nil
}

func runLoop(ctx context.Context, cfg Config, toolDefs []provider.ToolDefinition, out chan<- event.Event) {
	maxTurns := cfg.Agent.MaxTurns
	execMode := cfg.Agent.ToolExecMode()
	maxParallel := cfg.Agent.ToolMaxParallel()
	log := cfg.Logger
	tel := cfg.Telemetry

	// Start run span and inject telemetry into context for tools.
	runStart := time.Now()
	if tel != nil {
		var span trace.Span
		ctx, span = tel.StartRun(ctx, cfg.Agent.Name, cfg.Agent.Model)
		ctx = context.WithValue(ctx, "telemetry", tel)
		defer span.End()
	}

	// Accumulate token usage across all turns.
	var totalInputTokens, totalOutputTokens int

	if log == nil {
		log = slog.Default()
	}
	pol := cfg.Policy
	if pol == nil {
		pol = permission.AllowAllPolicy{}
	}
	hooks := cfg.Hooks
	approver := cfg.Approver
	if approver == nil {
		approver = DenyAllApprover{}
	}

	for turn := 1; turn <= maxTurns; turn++ {
		select {
		case <-ctx.Done():
			forceEmit(out, event.Event{Type: event.TypeError, Code: "cancelled", Message: ctx.Err().Error()})
			forceEmit(out, event.Event{Type: event.TypeDone, Status: "cancelled", Turns: turn, InputTokens: totalInputTokens, OutputTokens: totalOutputTokens})
			return
		default:
		}

		// Start turn span.
		turnCtx := ctx
		var turnSpan trace.Span
		if tel != nil {
			turnCtx, turnSpan = tel.StartTurn(ctx, turn)
		}

		// OnTurnStart hook.
		if hooks != nil {
			if err := hooks.OnTurnStart(ctx, hook.TurnInfo{TurnNumber: turn}); err != nil {
				log.Warn("hook OnTurnStart error", "turn", turn, "error", err)
			}
		}

		req := provider.Request{
			Model:     cfg.Agent.Model,
			Messages:  cfg.Session.GetMessages(),
			Tools:     toolDefs,
			MaxTokens: cfg.Agent.MaxTokens,
		}

		chunks, err := cfg.Provider.Stream(ctx, req)
		if err != nil {
			forceEmit(out, event.Event{Type: event.TypeError, Code: "provider_error", Message: err.Error()})
			forceEmit(out, event.Event{Type: event.TypeDone, Status: "failed", Turns: turn, InputTokens: totalInputTokens, OutputTokens: totalOutputTokens})
			return
		}

		var assistantText string
		var reasoningText string
		var assistantToolCalls []provider.ToolCall

		// Streaming tool execution for parallel mode.
		type pendingResult struct {
			idx      int
			callID   string
			toolName string
			output   json.RawMessage
		}
		resultCh := make(chan pendingResult, maxParallel*2)
		var execWg sync.WaitGroup // declared but only used in parallel mode
		sem := make(chan struct{}, maxParallel)
		toolIdx := 0

		// readStream consumes provider chunks. Tool calls are executed
		// immediately in parallel mode or collected for serial mode.
		for chunk := range chunks {
			// Accumulate token usage from provider.
			if chunk.InputTokens > 0 {
				totalInputTokens += chunk.InputTokens
			}
			if chunk.OutputTokens > 0 {
				totalOutputTokens += chunk.OutputTokens
			}

			if chunk.ReasoningDelta != "" {
				reasoningText += chunk.ReasoningDelta
				emit(ctx, out, event.Event{Type: event.TypeReasoningDelta, Content: chunk.ReasoningDelta})
			}
			if chunk.TextDelta != "" {
				assistantText += chunk.TextDelta
				emit(ctx, out, event.Event{Type: event.TypeTextDelta, Content: chunk.TextDelta})
			}
			for _, tc := range chunk.ToolCalls {
				assistantToolCalls = append(assistantToolCalls, tc)
				if execMode == "parallel" {
					idx := toolIdx
					toolIdx++
					execWg.Add(1)
					go func(tc provider.ToolCall, idx int) {
						defer execWg.Done()
						// Respect context cancellation.
						select {
						case <-ctx.Done():
							return
						case sem <- struct{}{}:
						}
						defer func() { <-sem }()

						res := executeOneTool(ctx, cfg.Registry, tc, out, log, pol, hooks, approver)
						select {
						case resultCh <- pendingResult{
							idx: idx, callID: tc.ID, toolName: tc.Name, output: res,
						}:
						case <-ctx.Done():
						}
					}(tc, idx)
				} else {
					toolIdx++
				}
			}
		}

		// Check if context was cancelled during stream processing.
		select {
		case <-ctx.Done():
			forceEmit(out, event.Event{Type: event.TypeError, Code: "cancelled", Message: ctx.Err().Error()})
			forceEmit(out, event.Event{Type: event.TypeDone, Status: "cancelled", Turns: turn, InputTokens: totalInputTokens, OutputTokens: totalOutputTokens})
			return
		default:
		}

		// No tool calls → assistant text-only response → done.
		if len(assistantToolCalls) == 0 {
			cfg.Session.AddMessages(provider.Message{
				Role:             provider.RoleAssistant,
				Content:          assistantText,
				ReasoningContent: reasoningText,
			})
			if turnSpan != nil {
				turnSpan.End()
			}
			if tel != nil {
				tel.RecordRunDuration(turnCtx, time.Since(runStart), attribute.String("agent.name", cfg.Agent.Name))
			}
			forceEmit(out, event.Event{Type: event.TypeDone, Status: "completed", Turns: turn, InputTokens: totalInputTokens, OutputTokens: totalOutputTokens})
			return
		}

		// Record the assistant message (with tool calls).
		cfg.Session.AddMessages(provider.Message{
			Role:             provider.RoleAssistant,
			Content:          assistantText,
			ReasoningContent: reasoningText,
			ToolCalls:        assistantToolCalls,
		})

		// Collect tool results in order.
		var toolResults []pendingResult
		if execMode == "parallel" {
			go func() {
				execWg.Wait()
				close(resultCh)
			}()
			// Build index-preserving slice.
			byIndex := make(map[int]pendingResult)
			for r := range resultCh {
				byIndex[r.idx] = r
			}
			for i := 0; i < toolIdx; i++ {
				if r, ok := byIndex[i]; ok {
					toolResults = append(toolResults, r)
				}
			}
		} else {
			// Serial mode: execute one at a time after all tool calls received.
			for i, tc := range assistantToolCalls {
				res := executeOneTool(ctx, cfg.Registry, tc, out, log, pol, hooks, approver)
				toolResults = append(toolResults, pendingResult{
					idx:      i,
					callID:   tc.ID,
					toolName: tc.Name,
					output:   res,
				})
			}
		}

		// OnTurnEnd hook.
		if hooks != nil {
			if err := hooks.OnTurnEnd(turnCtx, hook.TurnInfo{TurnNumber: turn}); err != nil {
				log.Warn("hook OnTurnEnd error", "turn", turn, "error", err)
			}
		}

		// End turn span and record metrics.
		if turnSpan != nil {
			turnSpan.End()
		}
		if tel != nil {
			tel.RecordTurn(turnCtx, attribute.Int("turn", turn))
		}

		// Record tool results in session.
		for _, tr := range toolResults {
			cfg.Session.AddMessages(provider.Message{
				Role:       provider.RoleTool,
				ToolCallID: tr.callID,
				Name:       tr.toolName,
				Content:    string(tr.output),
			})
		}

		// Context compaction: if configured, compact the session when it grows too large.
		if cfg.Agent.Compaction != nil {
			msgs := cfg.Session.GetMessages()
			cmp := compaction.NewCompactor(compaction.Config{
				Strategy:    compaction.Strategy(cfg.Agent.Compaction.Strategy),
				MaxMessages: cfg.Agent.Compaction.MaxMessages,
				KeepRecent:  cfg.Agent.Compaction.KeepRecent,
			})
			result, err := cmp.Compact(msgs)
			if err != nil {
				log.Warn("compaction error", "turn", turn, "error", err)
			} else if result != nil {
				cfg.Session.SetMessages(result.Compacted)
				emit(ctx, out, event.Event{
					Type:    event.TypeCompaction,
					Content: result.Summary,
				})
				log.Info("context compacted", "turn", turn, "old_messages", result.OldCount, "new_messages", result.NewCount)
			}
		}
	}

	// Record run duration.
	if tel != nil {
		tel.RecordRunDuration(ctx, time.Since(runStart), attribute.String("agent.name", cfg.Agent.Name))
	}

	forceEmit(out, event.Event{Type: event.TypeError, Code: "max_turns", Message: fmt.Sprintf("exceeded max turns %d", maxTurns)})
	forceEmit(out, event.Event{Type: event.TypeDone, Status: "failed", Turns: maxTurns, InputTokens: totalInputTokens, OutputTokens: totalOutputTokens})
}

// executeOneTool runs a single tool call and emits tool_start / tool_result events.
func executeOneTool(ctx context.Context, reg ToolRegistry, call provider.ToolCall, out chan<- event.Event, log *slog.Logger, pol permission.Policy, hooks *hook.Chain, approver Approver) json.RawMessage {
	// Prepare input for display.
	var input any
	if err := json.Unmarshal(call.Arguments, &input); err != nil {
		log.Warn("unmarshal tool arguments", "tool", call.Name, "error", err)
		input = string(call.Arguments)
	}
	inputJSON, err := json.Marshal(input)
	if err != nil {
		log.Warn("marshal tool input", "tool", call.Name, "error", err)
		inputJSON = call.Arguments
	}

	// Emit tool_start FIRST so the frontend has a tool entry.
	emit(ctx, out, event.Event{Type: event.TypeToolStart, Tool: call.Name, Input: json.RawMessage(inputJSON), ToolCallID: call.ID})

	// Permission check.
	decision := pol.Check(permission.ToolCall{Name: call.Name, Arguments: call.Arguments})
	if decision == permission.Deny {
		errJSON, _ := json.Marshal(map[string]string{"error": "permission denied", "tool": call.Name})
		emit(ctx, out, event.Event{
			Type:       event.TypeToolResult,
			Tool:       call.Name,
			Output:     json.RawMessage(errJSON),
			ToolCallID: call.ID,
		})
		return json.RawMessage(errJSON)
	}
	if decision == permission.Confirm {
		// Emit approval required event.
		emit(ctx, out, event.Event{
			Type:       event.TypeToolApproval,
			Tool:       call.Name,
			Input:      call.Arguments,
			ToolCallID: call.ID,
			ApprovalID: call.ID,
		})
		// Wait for approval decision.
		approved := approver.Approve(ctx, ApprovalRequest{
			Tool:       call.Name,
			Arguments:  call.Arguments,
			ApprovalID: call.ID,
		})
		if !approved {
			errJSON, _ := json.Marshal(map[string]string{"error": "tool approval denied", "tool": call.Name})
			emit(ctx, out, event.Event{
				Type:       event.TypeToolResult,
				Tool:       call.Name,
				Output:     json.RawMessage(errJSON),
				ToolCallID: call.ID,
			})
			return json.RawMessage(errJSON)
		}
	}

	// OnToolStart hook.
	if hooks != nil {
		if err := hooks.OnToolStart(ctx, hook.ToolStartInfo{Name: call.Name, Arguments: call.Arguments}); err != nil {
			log.Warn("hook OnToolStart error", "tool", call.Name, "error", err)
		}
	}

	t, ok := reg.Get(call.Name)
	if !ok {
		errJSON, _ := json.Marshal(map[string]string{"error": "tool not found"})
		if hooks != nil {
			hooks.OnToolResult(ctx, hook.ToolResultInfo{Name: call.Name, Output: errJSON, Error: fmt.Errorf("tool not found")})
		}
		emit(ctx, out, event.Event{
			Type:       event.TypeToolResult,
			Tool:       call.Name,
			Output:     json.RawMessage(errJSON),
			ToolCallID: call.ID,
		})
		return json.RawMessage(errJSON)
	}

	// Inject parent event channel into context for sub-agent event bubbling.
	toolCtx := context.WithValue(ctx, "parent_event_chan", out)

	// Start tool span.
	toolStart := time.Now()
	var toolSpan trace.Span
	// Check if telemetry is available via context (passed from loop).
	if tel, ok := ctx.Value("telemetry").(*telemetry.Telemetry); ok && tel != nil {
		toolCtx, toolSpan = tel.StartTool(toolCtx, call.Name)
	}

	res, execErr := t.Execute(toolCtx, call.Arguments)
	toolDuration := time.Since(toolStart)

	// End tool span and record metrics.
	if toolSpan != nil {
		toolSpan.End()
	}
	if tel, ok := ctx.Value("telemetry").(*telemetry.Telemetry); ok && tel != nil {
		tel.RecordToolDuration(ctx, toolDuration, attribute.String("tool.name", call.Name))
		if execErr != nil {
			tel.RecordToolError(ctx, attribute.String("tool.name", call.Name))
		}
	}

	if execErr != nil {
		outVal, _ := json.Marshal(map[string]string{"error": execErr.Error()})
		if hooks != nil {
			hooks.OnToolResult(ctx, hook.ToolResultInfo{Name: call.Name, Output: outVal, Error: execErr})
		}
		emit(ctx, out, event.Event{Type: event.TypeToolResult, Tool: call.Name, Output: json.RawMessage(outVal), ToolCallID: call.ID})
		return json.RawMessage(outVal)
	}

	if hooks != nil {
		hooks.OnToolResult(ctx, hook.ToolResultInfo{Name: call.Name, Output: res.Output})
	}
	emit(ctx, out, event.Event{Type: event.TypeToolResult, Tool: call.Name, Output: res.Output, ToolCallID: call.ID})
	return res.Output
}

func emit(ctx context.Context, out chan<- event.Event, ev event.Event) {
	select {
	case out <- ev:
	case <-ctx.Done():
	}
}

// forceEmitTimeout is the maximum duration to wait for a terminal event
// to be delivered before falling back to a log warning.
var forceEmitTimeout = 5 * time.Second

// forceEmit sends a terminal event (cancelled, done, error) to the channel
// with a timeout fallback. If the consumer is stuck and the event cannot be
// delivered within forceEmitTimeout, the event is dropped and a warning is
// logged to prevent the loop from blocking indefinitely.
func forceEmit(out chan<- event.Event, ev event.Event) {
	timer := time.NewTimer(forceEmitTimeout)
	defer timer.Stop()
	select {
	case out <- ev:
	case <-timer.C:
		slog.Warn("forceEmit timed out, dropping terminal event",
			slog.String("event_type", string(ev.Type)),
			slog.String("status", ev.Status),
			slog.String("code", ev.Code),
		)
	}
}
