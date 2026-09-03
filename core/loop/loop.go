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
	args     json.RawMessage
}

// Run executes the agent loop and streams events.
func Run(ctx context.Context, cfg Config) (<-chan event.Event, error) {
	if err := validateRunConfig(cfg); err != nil {
		return nil, err
	}
	cfg, err := prepareSession(cfg)
	if err != nil {
		return nil, err
	}
	toolDefs, err := cfg.Registry.Definitions(cfg.Agent.Tools)
	if err != nil {
		return nil, err
	}
	seedMessages(cfg)
	cfg.failStreak = &toolFailStreak{}
	cfg.failStreak.seed(cfg.Session.GetMessages())
	ctx = attachRunContext(ctx, cfg)

	out := make(chan event.Event)
	go func() {
		defer close(out)
		runLoop(ctx, cfg, toolDefs, out)

		if cfg.Store != nil {
			if err := cfg.Store.Save(cfg.Session); err != nil {
				slog.Warn("log.session.persist_failed", "session_id", cfg.Session.ID, "error", err)
			}
		}
	}()
	return out, nil
}

func runLoop(ctx context.Context, cfg Config, toolDefs []provider.ToolDefinition, out chan<- event.Event) {
	maxTurns := cfg.Agent.MaxTurns // 0 = unlimited until model returns without tool calls
	log := cfg.Logger
	tel := cfg.Telemetry
	window := resolveContextWindow(ctx, cfg)

	runStart := time.Now()
	if tel != nil {
		var span trace.Span
		ctx, span = tel.StartRun(ctx, cfg.Agent.Name, cfg.Agent.Model)
		ctx = WithTelemetry(ctx, tel)
		defer span.End()
	}

	var totalInputTokens, totalOutputTokens, totalCacheRead, totalCacheCreation int
	var lastTurn tokenDelta // most recent completed turn's usage, for done events
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

	for turn := 1; maxTurns <= 0 || turn <= maxTurns; turn++ {
		select {
		case <-ctx.Done():
			emitCancelled(out, doneStats{
				sessionID: cfg.Session.ID, turn: turn,
				input: lastTurn.input, output: lastTurn.output,
				cacheRead: lastTurn.cacheRead, cacheCreation: lastTurn.cacheCreation,
				window: window, totalInput: totalInputTokens, totalOutput: totalOutputTokens,
			})
			cfg.Session.AddUsage(totalInputTokens, totalOutputTokens, totalCacheRead, totalCacheCreation, window)
			persistSession(cfg)
			return
		default:
		}

		tc := TurnContext{Ctx: ctx, Config: cfg, ToolDefs: toolDefs, Out: out, Turn: turn, Log: log, Pol: pol, Hooks: hooks, Approver: approver, Tel: tel, ContextWindow: window, totalInput: totalInputTokens, totalOutput: totalOutputTokens}
		tokens, done := executeTurn(tc)
		lastTurn = tokens
		totalInputTokens += tokens.input
		totalOutputTokens += tokens.output
		totalCacheRead += tokens.cacheRead
		totalCacheCreation += tokens.cacheCreation
		// Persist after each completed turn so a page refresh mid-run
		// recovers the conversation up to the last finished turn via
		// GET /sessions/:id.
		persistSession(cfg)
		if done {
			cfg.Session.AddUsage(totalInputTokens, totalOutputTokens, totalCacheRead, totalCacheCreation, window)
			persistSession(cfg)
			return
		}
	}

	if tel != nil {
		tel.RecordRunDuration(ctx, time.Since(runStart), attribute.String("agent.name", cfg.Agent.Name))
	}
	forceEmit(out, event.Event{Type: event.TypeError, Code: "max_turns", Message: fmt.Sprintf("exceeded max turns %d", maxTurns)})
	forceEmit(out, event.Event{Type: event.TypeDone, Status: "failed", Turns: maxTurns, InputTokens: lastTurn.input, OutputTokens: lastTurn.output, ContextWindow: window, SessionID: cfg.Session.ID, CacheReadInputTokens: lastTurn.cacheRead, CacheCreationInputTokens: lastTurn.cacheCreation, TotalInputTokens: totalInputTokens, TotalOutputTokens: totalOutputTokens})
	cfg.Session.AddUsage(totalInputTokens, totalOutputTokens, totalCacheRead, totalCacheCreation, window)
	persistSession(cfg)
}

type tokenDelta struct {
	input, output int
	cacheRead     int
	cacheCreation int
}

// TurnContext holds all dependencies for a single agent turn.
type TurnContext struct {
	Ctx           context.Context
	Config        Config
	ToolDefs      []provider.ToolDefinition
	Out           chan<- event.Event
	Turn          int
	Log           *slog.Logger
	Pol           permission.Policy
	Hooks         *hook.Chain
	Approver      Approver
	Tel           *telemetry.Telemetry
	ContextWindow int
	// totalInput / totalOutput accumulate every completed turn's usage for
	// the run so the final done event can carry run-level totals.
	totalInput  int
	totalOutput int
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

	// Message count at request time; used to record real usage so the next
	// compaction can project the delta appended after this response.
	reqMsgCount := len(tc.Config.Session.GetMessages())
	chunks, err := tc.Config.Provider.Stream(tc.Ctx, provider.Request{
		Model: tc.Config.Agent.Model, Messages: tc.Config.Session.GetMessages(),
		Tools: tc.ToolDefs, MaxTokens: tc.Config.Agent.MaxTokens,
		ContextWindow: tc.ContextWindow,
	})
	if err != nil {
		forceEmit(tc.Out, event.Event{Type: event.TypeError, Code: "provider_error", Message: err.Error()})
		forceEmit(tc.Out, event.Event{Type: event.TypeDone, Status: "failed", Turns: tc.Turn, ContextWindow: tc.ContextWindow, SessionID: tc.Config.Session.ID})
		return tokenDelta{}, true
	}

	text, reasoning, toolCalls, tokens, cancelled := consumeStream(tc.Ctx, chunks, tc.Out)
	// Persist the real prompt token count reported by the provider. This is
	// the authoritative usage of the request that just completed.
	if tokens.input > 0 {
		tc.Config.Session.SetLastUsage(tokens.input, tokens.output, tokens.cacheRead, tokens.cacheCreation, reqMsgCount)
	}
	if cancelled {
		emitCancelled(tc.Out, doneStats{
			sessionID: tc.Config.Session.ID, turn: tc.Turn,
			input: tokens.input, output: tokens.output,
			cacheRead: tokens.cacheRead, cacheCreation: tokens.cacheCreation,
			window: tc.ContextWindow, totalInput: tc.totalInput, totalOutput: tc.totalOutput,
		})
		return tokens, true
	}

	if len(toolCalls) == 0 {
		tc.Config.Session.AddMessages(provider.Message{
			Role: provider.RoleAssistant, Content: text, ReasoningContent: reasoning,
		})
		endTurn(turnSpan, tc.Tel, turnCtx, tc.Turn)
		forceEmit(tc.Out, event.Event{Type: event.TypeDone, Status: "completed", Turns: tc.Turn, InputTokens: tokens.input, OutputTokens: tokens.output, CacheReadInputTokens: tokens.cacheRead, CacheCreationInputTokens: tokens.cacheCreation, ContextWindow: tc.ContextWindow, SessionID: tc.Config.Session.ID, TotalInputTokens: tc.totalInput, TotalOutputTokens: tc.totalOutput})
		// Compact even for plain text turns — otherwise pure chat sessions
		// (no tool calls) never trigger context management.
		compactIfNeeded(tc.Ctx, tc.Config, tc.Out, compactHint{turn: tc.Turn, log: tc.Log, window: tc.ContextWindow})
		return tokens, true
	}

	tc.Config.Session.AddMessages(provider.Message{
		Role: provider.RoleAssistant, Content: text, ReasoningContent: reasoning, ToolCalls: toolCalls,
	})

	tcc := ToolCollectContext{Ctx: tc.Ctx, Config: tc.Config, Out: tc.Out, ToolCalls: toolCalls, Pol: tc.Pol, Hooks: tc.Hooks, Approver: tc.Approver, Log: tc.Log}
	results := collectToolResults(tcc)
	fireOnTurnEnd(tc.Hooks, turnCtx, tc.Turn, tc.Log)
	endTurn(turnSpan, tc.Tel, turnCtx, tc.Turn)
	recordToolResults(tc.Config, results, tc.ContextWindow)
	compactIfNeeded(tc.Ctx, tc.Config, tc.Out, compactHint{turn: tc.Turn, log: tc.Log, window: tc.ContextWindow})

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
		tokens.cacheRead += chunk.CacheReadInputTokens
		tokens.cacheCreation += chunk.CacheCreationInputTokens

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
			case resultCh <- indexedResult{i, pendingResult{idx: i, callID: call.ID, toolName: call.Name, args: call.Arguments, output: res}}:
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
		results = append(results, pendingResult{idx: i, callID: call.ID, toolName: call.Name, args: call.Arguments, output: res})
	}
	return results
}

func recordToolResults(cfg Config, results []pendingResult, window int) {
	budget := maxToolResultBytes
	if window > 0 {
		budget = toolResultBudget(currentPressure(cfg, window))
	}
	for _, tr := range results {
		content := truncateToolOutputBudget(string(tr.output), budget)
		if cfg.failStreak != nil {
			content = cfg.failStreak.annotate(tr.toolName, tr.args, tr.output, content)
		}
		cfg.Session.AddMessages(provider.Message{
			Role: provider.RoleTool, ToolCallID: tr.callID, Name: tr.toolName, Content: content,
		})
	}
}

// currentPressure estimates current context usage as a fraction of the
// effective context window, preferring the provider's last real input_tokens
// over a raw estimate (more accurate for CJK-heavy history).
func currentPressure(cfg Config, window int) float64 {
	if window <= 0 {
		return 0
	}
	lastInput, _, lastMsgCount := cfg.Session.LastUsage()
	msgs := cfg.Session.GetMessages()
	used := compaction.EstimateTokens(msgs)
	if lastInput > 0 && lastMsgCount > 0 && lastMsgCount < len(msgs) {
		used = lastInput + compaction.EstimateTokens(msgs[lastMsgCount:])
	}
	return float64(used) / float64(window)
}

func fireOnTurnStart(hooks *hook.Chain, turn int, log *slog.Logger) {
	if hooks != nil {
		if err := hooks.OnTurnStart(context.Background(), hook.TurnInfo{TurnNumber: turn}); err != nil {
			log.Warn("log.hook.turn_start_error", "turn", turn, "error", err)
		}
	}
}

func fireOnTurnEnd(hooks *hook.Chain, ctx context.Context, turn int, log *slog.Logger) {
	if hooks != nil {
		if err := hooks.OnTurnEnd(ctx, hook.TurnInfo{TurnNumber: turn}); err != nil {
			log.Warn("log.hook.turn_end_error", "turn", turn, "error", err)
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

// persistSession saves the current session state to the store, if configured.
// Failures are non-fatal: a stale on-disk copy is better than aborting a run.
func persistSession(cfg Config) {
	if cfg.Store == nil {
		return
	}
	if err := cfg.Store.Save(cfg.Session); err != nil {
		slog.Warn("log.session.persist_failed", "session_id", cfg.Session.ID, "error", err)
	}
}

type doneStats struct {
	sessionID     string
	turn          int
	input         int
	output        int
	cacheRead     int
	cacheCreation int
	window        int
	totalInput    int
	totalOutput   int
}

func emitCancelled(out chan<- event.Event, s doneStats) {
	forceEmit(out, event.Event{Type: event.TypeError, Code: "cancelled", Message: "context cancelled"})
	forceEmit(out, event.Event{
		Type: event.TypeDone, Status: "cancelled", Turns: s.turn,
		InputTokens: s.input, OutputTokens: s.output,
		CacheReadInputTokens: s.cacheRead, CacheCreationInputTokens: s.cacheCreation,
		ContextWindow: s.window, SessionID: s.sessionID,
		TotalInputTokens: s.totalInput, TotalOutputTokens: s.totalOutput,
	})
}
