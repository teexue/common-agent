package compaction

import (
	"context"

	"github.com/teexue/common-agent/core/provider"
)

// CascadeCompactor implements a tiered compaction cascade that escalates from
// the lightest intervention to the heaviest, mirroring Claude Code's design:
//
//  1. Trim   — shrink verbose tool results in place (no LLM, no data loss
//     beyond chatty output).
//  2. Snip   — progressively drop oldest middle turns into a key-facts block
//     (no LLM, LRU-style archival).
//  3. Collapse — LLM-summarize older turns when snip alone cannot fit the
//     budget (falls back to snip when no provider is configured).
//
// Each tier runs only if the previous one did not bring estimated tokens
// down to the target budget, so the conversation degrades gracefully rather
// than cliff-edge.
type CascadeCompactor struct {
	tokenLimit    int // trigger line (unused for fit, kept for legacy triggers)
	targetTokens  int // post-compaction budget
	contextWindow int
	keepRecent    int
	keepHead      int
	currentTokens int
	provider      provider.Provider
	model         string
	maxOutput     int
}

// NewCascadeCompactor creates a CascadeCompactor.
func NewCascadeCompactor(cfg Config) *CascadeCompactor {
	kR := cfg.KeepRecent
	if kR <= 0 {
		kR = defaultKeepRecent
	}
	kH := cfg.KeepHead
	if kH < 0 {
		kH = 0
	}
	return &CascadeCompactor{
		tokenLimit:    cfg.TokenLimit,
		targetTokens:  cfg.TargetTokens,
		contextWindow: cfg.ContextWindow,
		keepRecent:    kR,
		keepHead:      kH,
		currentTokens: cfg.CurrentTokens,
		provider:      cfg.Provider,
		model:         cfg.Model,
		maxOutput:     cfg.MaxOutput,
	}
}

// Compact runs the cascade. Returns nil when no compaction is needed.
func (c *CascadeCompactor) Compact(ctx context.Context, messages []provider.Message) (*Result, error) {
	if !NeedsCompactionByTokensCount(c.currentUsage(messages), c.targetTokens) {
		return nil, nil
	}
	oldCount := len(messages)
	msgs := messages

	// Tier 1: trim verbose tool results in place.
	if c.pressure(msgs) > trimRatio {
		msgs = TrimToolResults(msgs, c.trimBudget())
		if EstimateTokens(msgs) <= c.targetTokens {
			return &Result{
				Compacted: msgs, OldCount: oldCount, NewCount: len(msgs),
				Summary: "[compaction: trimmed verbose tool outputs]",
			}, nil
		}
	}

	// Tier 2: snip — progressive drop + facts (no LLM).
	snip := NewTruncationCompactorWithHead(c.tokenLimit, 0, c.keepRecent, c.keepHead)
	snip.targetTokens = c.targetTokens
	snip.currentTokens = c.currentTokens
	res, err := snip.Compact(ctx, msgs)
	if err != nil {
		return nil, err
	}
	if res != nil && EstimateTokens(res.Compacted) <= c.targetTokens {
		return res, nil
	}
	if res != nil {
		msgs = res.Compacted // collapse from the already-snipped state
	}

	// Tier 3: collapse — LLM summarization when snip could not fit.
	if c.provider != nil {
		sc := NewSummarizingCompactor(SummarizeConfig{
			Provider:   c.provider,
			Model:      c.model,
			TokenLimit: c.tokenLimit,
			MaxOutput:  c.maxOutput,
			KeepRecent: c.keepRecent,
			KeepHead:   c.keepHead,
		})
		sc.currentTokens = c.currentTokens
		sres, serr := sc.Compact(ctx, msgs)
		if serr == nil && sres != nil {
			return sres, nil
		}
	}
	return res, nil // fall back to the snip result if collapse failed
}

// currentUsage returns the known token usage when available, else the estimate.
func (c *CascadeCompactor) currentUsage(messages []provider.Message) int {
	if c.currentTokens > 0 {
		return c.currentTokens
	}
	return EstimateTokens(messages)
}

// pressure returns current usage as a fraction of the context window.
func (c *CascadeCompactor) pressure(messages []provider.Message) float64 {
	usage := c.currentUsage(messages)
	if c.contextWindow > 0 {
		return float64(usage) / float64(c.contextWindow)
	}
	if c.targetTokens > 0 {
		return float64(usage) / float64(c.targetTokens)
	}
	return 1
}

// trimBudget returns the per-tool-result byte budget for the trim tier,
// shrinking as pressure rises: ~32KB at trimRatio down to ~8KB near full.
func (c *CascadeCompactor) trimBudget() int {
	const maxBudget = 32 * 1024
	const minBudget = 8 * 1024
	p := c.pressure(nil)
	if p < trimRatio {
		p = trimRatio
	}
	budget := maxBudget - int((p-trimRatio)*float64(maxBudget-minBudget)/(1-trimRatio))
	if budget < minBudget {
		return minBudget
	}
	if budget > maxBudget {
		return maxBudget
	}
	return budget
}

// TrimToolResults returns messages with over-long tool result bodies
// truncated to budget bytes (plus a marker). It is the lightest compaction
// tier: no turns are dropped, only chatty tool output is slimmed.
func TrimToolResults(messages []provider.Message, budget int) []provider.Message {
	if budget <= 0 {
		return messages
	}
	out := make([]provider.Message, len(messages))
	for i, m := range messages {
		if m.Role == provider.RoleTool && len(m.Content) > budget {
			cp := m
			cp.Content = truncateTailBytes(m.Content[:budget], budget) + "\n...[tool output trimmed]"
			out[i] = cp
		} else {
			out[i] = m
		}
	}
	return out
}
