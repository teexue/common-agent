// Package compaction provides context window management for long conversations.
// Compaction is driven by estimated token usage relative to the model context
// window (not by raw message count).
package compaction

import (
	"context"

	"github.com/teexue/common-agent/core/provider"
)

// Strategy identifies a compaction strategy.
type Strategy string

const (
	StrategyTruncation Strategy = "truncation"
	StrategySliding    Strategy = "sliding_window"
	StrategySummarize  Strategy = "summarize"
)

// Result describes what a compaction pass did.
type Result struct {
	// Compacted is the new message list after compaction.
	Compacted []provider.Message
	// OldCount is the number of messages before compaction.
	OldCount int
	// NewCount is the number of messages after compaction.
	NewCount int
	// Summary is the generated summary text.
	Summary string
}

// Compactor reduces a message list to fit within a context window.
type Compactor interface {
	// Compact reduces the messages and returns the result.
	// If no compaction is needed, it returns nil, nil.
	Compact(ctx context.Context, messages []provider.Message) (*Result, error)
}

// Config configures compaction behavior.
type Config struct {
	Strategy Strategy `yaml:"strategy"`
	// TokenLimit is the soft cap on estimated prompt tokens. 0 disables token trigger.
	TokenLimit int `yaml:"token_limit"`
	// MaxMessages is an optional legacy secondary trigger. 0 disables it.
	MaxMessages int `yaml:"max_messages"`
	// KeepRecent is the number of recent conversation messages to preserve.
	KeepRecent int `yaml:"keep_recent"`
	// KeepHead is the number of oldest conversation messages to preserve
	// verbatim. It keeps the prompt prefix stable for provider-side prompt
	// caching and retains the initial task definition.
	KeepHead int `yaml:"keep_head"`
	// CurrentTokens is the known token usage of the message list (e.g. the
	// real input_tokens reported by the provider for the last request, plus
	// an estimate of messages appended since). When 0, usage is derived from
	// EstimateTokens.
	CurrentTokens int `yaml:"-"`
	// Provider drives LLM summarization for StrategySummarize. When nil, the
	// summarize strategy falls back to truncation.
	Provider provider.Provider `yaml:"-"`
	// Model is the model used for LLM summarization.
	Model string `yaml:"-"`
	// MaxOutput caps the generated summary length in tokens.
	MaxOutput int `yaml:"-"`
}

const (
	defaultKeepRecent   = 20
	defaultKeepHead     = 2
	defaultTriggerRatio = 0.85
)

// Defaults returns a Config with default values applied.
func (c Config) Defaults() Config {
	if c.KeepRecent <= 0 {
		c.KeepRecent = defaultKeepRecent
	}
	if c.KeepHead < 0 {
		c.KeepHead = 0
	} else if c.KeepHead == 0 {
		c.KeepHead = defaultKeepHead
	}
	if c.Strategy == "" {
		c.Strategy = StrategyTruncation
	}
	return c
}

// NewCompactor creates a Compactor for the given config.
func NewCompactor(cfg Config) Compactor {
	cfg = cfg.Defaults()
	switch cfg.Strategy {
	case StrategySliding:
		return NewSlidingWindowCompactor(cfg.KeepRecent)
	case StrategySummarize:
		if cfg.Provider == nil {
			// No provider available — degrade to truncation so the loop
			// never fails because summarization is unavailable.
			tc := NewTruncationCompactorWithHead(cfg.TokenLimit, cfg.MaxMessages, cfg.KeepRecent, cfg.KeepHead)
			tc.currentTokens = cfg.CurrentTokens
			return tc
		}
		sc := NewSummarizingCompactor(SummarizeConfig{
			Provider:   cfg.Provider,
			Model:      cfg.Model,
			TokenLimit: cfg.TokenLimit,
			MaxOutput:  cfg.MaxOutput,
			KeepRecent: cfg.KeepRecent,
			KeepHead:   cfg.KeepHead,
		})
		sc.currentTokens = cfg.CurrentTokens
		return sc
	default:
		tc := NewTruncationCompactorWithHead(cfg.TokenLimit, cfg.MaxMessages, cfg.KeepRecent, cfg.KeepHead)
		tc.currentTokens = cfg.CurrentTokens
		return tc
	}
}

// NeedsCompaction returns true if the message list exceeds a message-count threshold.
// Prefer NeedsCompactionByTokens for production use.
func NeedsCompaction(messages []provider.Message, maxMessages int) bool {
	return maxMessages > 0 && len(messages) > maxMessages
}

// NeedsCompactionByTokens returns true when estimated tokens exceed the soft limit.
func NeedsCompactionByTokens(messages []provider.Message, tokenLimit int) bool {
	return tokenLimit > 0 && EstimateTokens(messages) > tokenLimit
}

// NeedsCompactionByTokensCount returns true when the given token count exceeds
// the soft limit. Prefer it over NeedsCompactionByTokens when the caller has a
// known token count (e.g. real provider usage) instead of an estimate.
func NeedsCompactionByTokensCount(tokens, tokenLimit int) bool {
	return tokenLimit > 0 && tokens > tokenLimit
}

// EstimateTokens approximates prompt tokens for a message list. CJK characters
// are weighted ~1 token per character; other text uses the ~4 bytes/token
// English convention. This keeps the estimate close to real tokenizer output
// for both Chinese and code-heavy conversations.
func EstimateTokens(messages []provider.Message) int {
	n := 0
	for _, m := range messages {
		n += estimateString(m.Content)
		n += estimateString(m.ReasoningContent)
		n += estimateString(m.Name)
		n += estimateString(m.ToolCallID)
		for _, tc := range m.ToolCalls {
			n += estimateString(tc.ID)
			n += estimateString(tc.Name)
			n += estimateString(string(tc.Arguments))
			n += 8
		}
		for _, p := range m.ContentParts {
			n += estimateString(p.Text)
			if p.ImageURL != nil {
				n += 765 // rough multimodal overhead
			}
		}
		n += 4 // role / framing overhead
	}
	return n
}

func estimateString(s string) int {
	if s == "" {
		return 0
	}
	// A CJK rune is 3 bytes in UTF-8 and costs ~1 token; everything else is
	// approximated at 4 bytes per token (English/code convention).
	cjk := 0
	for _, r := range s {
		if isCJK(r) {
			cjk++
		}
	}
	asciiBytes := len(s) - cjk*3
	return cjk + (asciiBytes+3)/4
}

// isCJK reports whether r is a CJK ideograph, kana, hangul syllable, or CJK
// punctuation / fullwidth form that tokenizers typically charge ~1 token for.
func isCJK(r rune) bool {
	return (r >= 0x2E80 && r <= 0x303F) || // CJK radicals + punctuation
		(r >= 0x3040 && r <= 0x30FF) || // kana
		(r >= 0x3400 && r <= 0x4DBF) || // CJK ext A
		(r >= 0x4E00 && r <= 0x9FFF) || // CJK unified
		(r >= 0xAC00 && r <= 0xD7AF) || // hangul syllables
		(r >= 0xF900 && r <= 0xFAFF) || // CJK compatibility
		(r >= 0xFF00 && r <= 0xFFEF) // fullwidth forms
}

// ResolveTokenLimit derives the soft compaction threshold from a context window.
// reserveTokens should cover the next model completion (typically agent max_tokens).
// triggerRatio defaults to 0.85 when <= 0 or >= 1.
func ResolveTokenLimit(contextWindow, reserveTokens int, triggerRatio float64) int {
	if contextWindow <= 0 {
		return 0
	}
	if triggerRatio <= 0 || triggerRatio >= 1 {
		triggerRatio = defaultTriggerRatio
	}
	if reserveTokens < 0 {
		reserveTokens = 0
	}
	limit := int(float64(contextWindow)*triggerRatio) - reserveTokens
	if limit < contextWindow/4 {
		limit = contextWindow / 4
	}
	return limit
}
