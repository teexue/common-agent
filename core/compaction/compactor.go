// Package compaction provides context window management for long conversations.
// Compaction is driven by estimated token usage relative to the model context
// window (not by raw message count).
package compaction

import "github.com/teexue/common-agent/core/provider"

// Strategy identifies a compaction strategy.
type Strategy string

const (
	StrategyTruncation Strategy = "truncation"
	StrategySliding    Strategy = "sliding_window"
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
	Compact(messages []provider.Message) (*Result, error)
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
}

const (
	defaultKeepRecent  = 20
	defaultTriggerRatio = 0.85
)

// Defaults returns a Config with default values applied.
func (c Config) Defaults() Config {
	if c.KeepRecent <= 0 {
		c.KeepRecent = defaultKeepRecent
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
	default:
		return NewTruncationCompactor(cfg.TokenLimit, cfg.MaxMessages, cfg.KeepRecent)
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

// EstimateTokens approximates prompt tokens for a message list (chars/3 heuristic).
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
	return (len(s) + 2) / 3
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
