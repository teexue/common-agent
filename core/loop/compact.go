package loop

import (
	"context"
	"log/slog"

	"github.com/teexue/common-agent/core/compaction"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/provider"
)

// resolveContextWindow resolves the model context window. An explicit agent
// value wins, then the model's official spec, then a conservative default.
// When the provider knows the model's real runtime limit (e.g. Ollama via
// /api/show), it overrides the static default so compaction and the server's
// actual context size agree.
func resolveContextWindow(ctx context.Context, cfg Config) int {
	configured := cfg.ContextWindow
	if cfg.Agent.Compaction != nil && cfg.Agent.Compaction.ContextWindow > 0 {
		configured = cfg.Agent.Compaction.ContextWindow
	}
	if r, ok := cfg.Provider.(provider.ContextResolver); ok {
		return r.ResolveContextWindow(ctx, cfg.Agent.Model, configured)
	}
	return provider.EffectiveContextWindow(cfg.Agent.Model, configured)
}

type compactHint struct {
	turn   int
	log    *slog.Logger
	window int
}

// compactIfNeeded runs the configured compaction strategy after a turn when
// the projected prompt usage exceeds the context window budget. window is the
// already-resolved effective context window (passed in so /api/show is not
// re-fetched per turn).
func compactIfNeeded(ctx context.Context, cfg Config, out chan<- event.Event, hint compactHint) {
	comp := cfg.Agent.Compaction
	ratio := 0.0
	keepRecent := 0
	keepHead := 0
	maxMessages := 0
	strategy := compaction.StrategyTruncation
	summaryModel := cfg.Agent.Model
	if comp != nil {
		ratio = comp.TriggerRatio
		keepRecent = comp.KeepRecent
		keepHead = comp.KeepHead
		maxMessages = comp.MaxMessages
		strategy = compaction.Strategy(comp.Strategy)
		if comp.SummaryModel != "" {
			summaryModel = comp.SummaryModel
		}
	}
	// Reserve tokens for the compaction summary output and the next
	// completion: min(maxOutput, 20K), aligning with Claude Code's budget.
	maxOut := provider.EffectiveMaxOutput(cfg.Agent.Model, cfg.Agent.MaxTokens)
	reserve := compaction.SummaryBudget(maxOut)
	tokenLimit := compaction.ResolveTokenLimit(hint.window, reserve, ratio)
	if tokenLimit <= 0 && maxMessages <= 0 {
		return // no context window and no legacy message trigger
	}
	// Compress down to a target below the trigger line so several new turns
	// can accrue before compaction fires again (avoids re-firing every turn).
	targetRatio := 0.0
	if comp != nil {
		targetRatio = comp.TargetRatio
	}
	targetLimit := compaction.ResolveTargetLimit(hint.window, reserve, targetRatio)

	// Project the usage the next request would hit: last real input_tokens
	// from the provider plus an estimate of messages appended since. This
	// avoids relying on a raw estimate for the whole (often CJK-heavy)
	// history and lets compaction fire before the context window fills.
	lastInput, _, lastMsgCount := cfg.Session.LastUsage()
	msgs := cfg.Session.GetMessages()
	currentTokens := compaction.EstimateTokens(msgs)
	if lastInput > 0 && lastMsgCount > 0 && lastMsgCount < len(msgs) {
		currentTokens = lastInput + compaction.EstimateTokens(msgs[lastMsgCount:])
	}

	cmp := compaction.NewCompactor(compaction.Config{
		Strategy:      strategy,
		TokenLimit:    tokenLimit,
		MaxMessages:   maxMessages,
		KeepRecent:    keepRecent,
		KeepHead:      keepHead,
		CurrentTokens: currentTokens,
		TargetTokens:  targetLimit,
		ContextWindow: hint.window,
		Provider:      cfg.Provider,
		Model:         summaryModel,
		MaxOutput:     reserve,
	})
	result, err := cmp.Compact(ctx, msgs)
	if err != nil {
		hint.log.Warn("log.compaction.error", "turn", hint.turn, "error", err)
	} else if result != nil {
		cfg.Session.SetMessages(result.Compacted)
		// The recorded real usage no longer describes the message list;
		// drop it so the next projection starts from the compacted state.
		cfg.Session.ClearUsage()
		emit(ctx, out, event.Event{Type: event.TypeCompaction, Content: result.Summary})
		hint.log.Info("log.compaction.compacted",
			"turn", hint.turn,
			"old_messages", result.OldCount,
			"new_messages", result.NewCount,
			"token_limit", tokenLimit,
			"current_tokens", currentTokens,
			"est_tokens", compaction.EstimateTokens(result.Compacted),
		)
	}
}

// compactMessages applies the default truncation strategy and returns the
// compacted message list, or nil when no compaction is needed. Used by tests.
func compactMessages(ctx context.Context, messages []provider.Message, tokenLimit, maxMessages, keepRecent int) []provider.Message {
	cmp := compaction.NewCompactor(compaction.Config{
		Strategy:    compaction.StrategyTruncation,
		TokenLimit:  tokenLimit,
		MaxMessages: maxMessages,
		KeepRecent:  keepRecent,
	})
	result, err := cmp.Compact(ctx, messages)
	if err != nil || result == nil {
		return nil
	}
	return result.Compacted
}

// compactionTokenLimit derives the soft compaction threshold from a model
// window with default trigger ratio, mirroring compactIfNeeded.
func compactionTokenLimit(window, reserve int, _ float64) int {
	return compaction.ResolveTokenLimit(window, reserve, 0)
}
