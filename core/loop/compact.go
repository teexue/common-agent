package loop

import (
	"context"
	"log/slog"

	"github.com/teexue/common-agent/core/compaction"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/provider"
)

// effectiveContextWindow resolves the model context window exactly like
// compactIfNeeded: an explicit agent value wins, then the model's official
// spec, then a conservative default.
func effectiveContextWindow(cfg Config) int {
	window := cfg.ContextWindow
	if cfg.Agent.Compaction != nil && cfg.Agent.Compaction.ContextWindow > 0 {
		window = cfg.Agent.Compaction.ContextWindow
	}
	return provider.EffectiveContextWindow(cfg.Agent.Model, window)
}

// compactIfNeeded runs the configured compaction strategy after a turn when
// the projected prompt usage exceeds the context window budget.
func compactIfNeeded(ctx context.Context, cfg Config, out chan<- event.Event, turn int, log *slog.Logger) {
	comp := cfg.Agent.Compaction
	window := effectiveContextWindow(cfg)
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
	// Reserve the model's max output so the next completion always fits.
	reserve := provider.EffectiveMaxOutput(cfg.Agent.Model, cfg.Agent.MaxTokens)
	tokenLimit := compaction.ResolveTokenLimit(window, reserve, ratio)
	if tokenLimit <= 0 && maxMessages <= 0 {
		return // no context window and no legacy message trigger
	}

	// Project the usage the next request would hit: last real input_tokens
	// from the provider plus an estimate of messages appended since. This
	// avoids relying on a raw estimate for the whole (often CJK-heavy)
	// history and lets compaction fire before the context window fills.
	lastInput, lastMsgCount := cfg.Session.LastUsage()
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
		Provider:      cfg.Provider,
		Model:         summaryModel,
		MaxOutput:     0,
	})
	result, err := cmp.Compact(ctx, msgs)
	if err != nil {
		log.Warn("log.compaction.error", "turn", turn, "error", err)
	} else if result != nil {
		cfg.Session.SetMessages(result.Compacted)
		// The recorded real usage no longer describes the message list;
		// drop it so the next projection starts from the compacted state.
		cfg.Session.ClearUsage()
		emit(ctx, out, event.Event{Type: event.TypeCompaction, Content: result.Summary})
		log.Info("log.compaction.compacted",
			"turn", turn,
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
