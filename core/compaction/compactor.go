// Package compaction provides context window management for long conversations.
// When the message history grows too large, a Compactor reduces it while
// preserving essential context (system prompt, recent messages, tool pairs).
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
	// Summary is the generated summary text (empty for truncation).
	Summary string
}

// Compactor reduces a message list to fit within a context window.
type Compactor interface {
	// Compact reduces the messages and returns the result.
	// If no compaction is needed, it returns Compacted == nil.
	Compact(messages []provider.Message) (*Result, error)
}

// Config configures compaction behavior.
type Config struct {
	// Strategy is the compaction strategy to use.
	Strategy Strategy `yaml:"strategy"`
	// MaxMessages triggers compaction when message count exceeds this.
	// 0 means disabled.
	MaxMessages int `yaml:"max_messages"`
	// KeepRecent is the number of recent messages to preserve.
	KeepRecent int `yaml:"keep_recent"`
}

const (
	defaultMaxMessages = 100
	defaultKeepRecent  = 20
)

// Defaults returns a Config with default values applied.
func (c Config) Defaults() Config {
	if c.MaxMessages <= 0 {
		c.MaxMessages = defaultMaxMessages
	}
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
		return NewTruncationCompactor(cfg.MaxMessages, cfg.KeepRecent)
	}
}

// NeedsCompaction returns true if the message list exceeds the configured threshold.
func NeedsCompaction(messages []provider.Message, maxMessages int) bool {
	return maxMessages > 0 && len(messages) > maxMessages
}
