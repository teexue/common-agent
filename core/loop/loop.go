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

	"github.com/teexue/common-agent/core/compaction"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/hook"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/telemetry"
)

// pendingResult holds a tool execution result for ordered collection.
type pendingResult struct {
	idx      int
	callID   string
	toolName string
	output   json.RawMessage
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

	if cfg.WorkDir != "" {
		ctx = context.WithValue(ctx, workDirCtxKey, cfg.WorkDir)
	}

	out := make(chan event.Event)
	go func() {
		defer close(out)
		runLoop(ctx, cfg, toolDefs, out)

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
	log := cfg.Logger
	tel := cfg.Telemetry

	runStart := time.Now()
	if tel != nil {
		var span trace.Span
		ctx, span = tel.StartRun(ctx, cfg.Agent.Name, cfg.Agent.Model)
		ctx = context.WithValue(ctx, "telemetry", tel)
		defer span.End()
	}

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
			emitCancelled(out, turn, totalInputTokens, totalOutputTokens)
			return
		default:
		}

		tc := TurnContext{Ctx: ctx, Config: cfg, ToolDefs: toolDefs, Out: out, Turn: turn, Log: log, Pol: pol, Hooks: hooks, Approver: approver, Tel: tel}
		tokens, done := executeTurn(tc)
		totalInputTokens += tokens.input
		totalOutputTokens += tokens.output
		if done {
			return
		}
	}

	if tel != nil {
		tel.RecordRunDuration(ctx, time.Since(runStart), attribute.String("agent.name", cfg.Agent.Name))
	}
	forceEmit(out, event.Event{Type: event.TypeError, Code: "max_turns", Message: fmt.Sprintf("exceeded max turns %d", maxTurns)})
	forceEmit(out, event.Event{Type: event.TypeDone, Status: "failed", Turns: maxTurns, InputTokens: totalInputTokens, OutputTokens: totalOutputTokens})
}

type tokenDelta struct{ input, output int }

// TurnContext holds all dependencies for a single agent turn.
type TurnContext struct {
	Ctx      context.Context
	Config   Config
	ToolDefs []provider.ToolDefinition
	Out      chan<- event.Event
	Turn     int
	Log      *slog.Logger
	Pol      permission.Policy
	Hooks    *hook.Chain
	Approver Approver
	Tel      *telemetry.Telemetry
}

// executeTurn executes a single turn of the agent loop. Returns token deltas and
// whether the loop should terminate (text-only response, cancellation, or error).
func executeTurn(tc TurnContext) (tokenDelta, bool) {
	turnCtx := tc.Ctx
	var turnSpan trace.Span
	if tc.Tel != nil {
		turnCtx, turnSpan = tc.Tel.StartTurn(tc.Ctx, tc.Turn)
	}

	fireOnTurnStart(tc.Hooks, tc.Turn, tc.Log)

	chunks, err := tc.Config.Provider.Stream(tc.Ctx, provider.Request{
		Model: tc.Config.Agent.Model, Messages: tc.Config.Session.GetMessages(),
		Tools: tc.ToolDefs, MaxTokens: tc.Config.Agent.MaxTokens,
	})
	if err != nil {
		forceEmit(tc.Out, event.Event{Type: event.TypeError, Code: "provider_error", Message: err.Error()})
		forceEmit(tc.Out, event.Event{Type: event.TypeDone, Status: "failed", Turns: tc.Turn})
		return tokenDelta{}, true
	}

	text, reasoning, toolCalls, tokens, cancelled := consumeStream(tc.Ctx, chunks, tc.Out)
	if cancelled {
		emitCancelled(tc.Out, tc.Turn, tokens.input, tokens.output)
		return tokens, true
	}

	if len(toolCalls) == 0 {
		tc.Config.Session.AddMessages(provider.Message{
			Role: provider.RoleAssistant, Content: text, ReasoningContent: reasoning,
		})
		endTurn(turnSpan, tc.Tel, turnCtx, tc.Turn)
		forceEmit(tc.Out, event.Event{Type: event.TypeDone, Status: "completed", Turns: tc.Turn, InputTokens: tokens.input, OutputTokens: tokens.output})
		return tokens, true
	}

	tc.Config.Session.AddMessages(provider.Message{
		Role: provider.RoleAssistant, Content: text, ReasoningContent: reasoning, ToolCalls: toolCalls,
	})

	tcc := ToolCollectContext{Ctx: tc.Ctx, Config: tc.Config, Out: tc.Out, ToolCalls: toolCalls, Pol: tc.Pol, Hooks: tc.Hooks, Approver: tc.Approver, Log: tc.Log}
	results := collectToolResults(tcc)
	fireOnTurnEnd(tc.Hooks, turnCtx, tc.Turn, tc.Log)
	endTurn(turnSpan, tc.Tel, turnCtx, tc.Turn)
	recordToolResults(tc.Config, results)
	compactIfNeeded(tc.Ctx, tc.Config, tc.Out, tc.Turn, tc.Log)

	return tokens, false
}

// consumeStream reads provider chunks and collects text, reasoning, and tool calls.
func consumeStream(ctx context.Context, chunks <-chan provider.Chunk, out chan<- event.Event) (string, string, []provider.ToolCall, tokenDelta, bool) {
	var text, reasoning string
	var toolCalls []provider.ToolCall
	var tokens tokenDelta

	for chunk := range chunks {
		tokens.input += chunk.InputTokens
		tokens.output += chunk.OutputTokens

		if chunk.ReasoningDelta != "" {
			reasoning += chunk.ReasoningDelta
			emit(ctx, out, event.Event{Type: event.TypeReasoningDelta, Content: chunk.ReasoningDelta})
		}
		if chunk.TextDelta != "" {
			text += chunk.TextDelta
			emit(ctx, out, event.Event{Type: event.TypeTextDelta, Content: chunk.TextDelta})
		}
		toolCalls = append(toolCalls, chunk.ToolCalls...)
	}

	select {
	case <-ctx.Done():
		return text, reasoning, toolCalls, tokens, true
	default:
	}

	return text, reasoning, toolCalls, tokens, false
}

// ToolCollectContext holds dependencies for collecting tool results.
type ToolCollectContext struct {
	Ctx       context.Context
	Config    Config
	Out       chan<- event.Event
	ToolCalls []provider.ToolCall
	Pol       permission.Policy
	Hooks     *hook.Chain
	Approver  Approver
	Log       *slog.Logger
}

// collectToolResults gathers tool results in index order.
func collectToolResults(tc ToolCollectContext) []pendingResult {
	execMode := tc.Config.Agent.ToolExecMode()
	if execMode == "parallel" {
		return collectParallelResults(tc)
	}
	return collectSerialResults(tc)
}

func collectParallelResults(tc ToolCollectContext) []pendingResult {
	maxParallel := tc.Config.Agent.ToolMaxParallel()
	type indexedResult struct {
		idx    int
		result pendingResult
	}
	resultCh := make(chan indexedResult, maxParallel*2)
	var wg sync.WaitGroup
	sem := make(chan struct{}, maxParallel)

	for i, call := range tc.ToolCalls {
		wg.Add(1)
		go func(call provider.ToolCall, i int) {
			defer wg.Done()
			select {
			case <-tc.Ctx.Done():
				return
			case sem <- struct{}{}:
			}
			defer func() { <-sem }()
			res := executeOneTool(ToolExecContext{Ctx: tc.Ctx, Reg: tc.Config.Registry, Call: call, Out: tc.Out, Log: tc.Log, Pol: tc.Pol, Hooks: tc.Hooks, Approver: tc.Approver})
			select {
			case resultCh <- indexedResult{i, pendingResult{idx: i, callID: call.ID, toolName: call.Name, output: res}}:
			case <-tc.Ctx.Done():
			}
		}(call, i)
	}

	go func() { wg.Wait(); close(resultCh) }()

	byIndex := make(map[int]pendingResult)
	for r := range resultCh {
		byIndex[r.idx] = r.result
	}
	results := make([]pendingResult, 0, len(tc.ToolCalls))
	for i := 0; i < len(tc.ToolCalls); i++ {
		if r, ok := byIndex[i]; ok {
			results = append(results, r)
		}
	}
	return results
}

func collectSerialResults(tc ToolCollectContext) []pendingResult {
	results := make([]pendingResult, 0, len(tc.ToolCalls))
	for i, call := range tc.ToolCalls {
		res := executeOneTool(ToolExecContext{Ctx: tc.Ctx, Reg: tc.Config.Registry, Call: call, Out: tc.Out, Log: tc.Log, Pol: tc.Pol, Hooks: tc.Hooks, Approver: tc.Approver})
		results = append(results, pendingResult{idx: i, callID: call.ID, toolName: call.Name, output: res})
	}
	return results
}

func recordToolResults(cfg Config, results []pendingResult) {
	for _, tr := range results {
		cfg.Session.AddMessages(provider.Message{
			Role: provider.RoleTool, ToolCallID: tr.callID, Name: tr.toolName, Content: string(tr.output),
		})
	}
}

func compactIfNeeded(ctx context.Context, cfg Config, out chan<- event.Event, turn int, log *slog.Logger) {
	if cfg.Agent.Compaction == nil {
		return
	}
	cmp := compaction.NewCompactor(compaction.Config{
		Strategy:    compaction.Strategy(cfg.Agent.Compaction.Strategy),
		MaxMessages: cfg.Agent.Compaction.MaxMessages,
		KeepRecent:  cfg.Agent.Compaction.KeepRecent,
	})
	result, err := cmp.Compact(cfg.Session.GetMessages())
	if err != nil {
		log.Warn("compaction error", "turn", turn, "error", err)
	} else if result != nil {
		cfg.Session.SetMessages(result.Compacted)
		emit(ctx, out, event.Event{Type: event.TypeCompaction, Content: result.Summary})
		log.Info("context compacted", "turn", turn, "old_messages", result.OldCount, "new_messages", result.NewCount)
	}
}

func fireOnTurnStart(hooks *hook.Chain, turn int, log *slog.Logger) {
	if hooks != nil {
		if err := hooks.OnTurnStart(context.Background(), hook.TurnInfo{TurnNumber: turn}); err != nil {
			log.Warn("hook OnTurnStart error", "turn", turn, "error", err)
		}
	}
}

func fireOnTurnEnd(hooks *hook.Chain, ctx context.Context, turn int, log *slog.Logger) {
	if hooks != nil {
		if err := hooks.OnTurnEnd(ctx, hook.TurnInfo{TurnNumber: turn}); err != nil {
			log.Warn("hook OnTurnEnd error", "turn", turn, "error", err)
		}
	}
}

func endTurn(span trace.Span, tel *telemetry.Telemetry, ctx context.Context, turn int) {
	if span != nil {
		span.End()
	}
	if tel != nil {
		tel.RecordTurn(ctx, attribute.Int("turn", turn))
	}
}

func emitCancelled(out chan<- event.Event, turn, inputTokens, outputTokens int) {
	forceEmit(out, event.Event{Type: event.TypeError, Code: "cancelled", Message: "context cancelled"})
	forceEmit(out, event.Event{Type: event.TypeDone, Status: "cancelled", Turns: turn, InputTokens: inputTokens, OutputTokens: outputTokens})
}
