package compaction

import (
	"fmt"

	"github.com/teexue/common-agent/core/provider"
)

// SlidingWindowCompactor keeps a fixed window of the most recent messages.
// Prefer truncation with TokenLimit for context-window-driven compaction.
type SlidingWindowCompactor struct {
	keepRecent int
}

// NewSlidingWindowCompactor creates a SlidingWindowCompactor.
func NewSlidingWindowCompactor(keepRecent int) *SlidingWindowCompactor {
	return &SlidingWindowCompactor{keepRecent: keepRecent}
}

// Compact reduces messages to the configured window size.
// Returns nil if messages already fit within the window.
func (c *SlidingWindowCompactor) Compact(messages []provider.Message) (*Result, error) {
	if len(messages) <= c.keepRecent {
		return nil, nil
	}

	oldCount := len(messages)

	var systemMsgs []provider.Message
	var convMsgs []provider.Message
	for _, m := range messages {
		if m.Role == provider.RoleSystem {
			systemMsgs = append(systemMsgs, m)
		} else {
			convMsgs = append(convMsgs, m)
		}
	}

	keepCount := c.keepRecent
	if keepCount > len(convMsgs) {
		keepCount = len(convMsgs)
	}

	recent := convMsgs[len(convMsgs)-keepCount:]
	recent = ensureToolPairs(recent)

	compacted := make([]provider.Message, 0, len(systemMsgs)+len(recent))
	compacted = append(compacted, systemMsgs...)
	compacted = append(compacted, recent...)

	return &Result{
		Compacted: compacted,
		OldCount:  oldCount,
		NewCount:  len(compacted),
		Summary:   fmt.Sprintf("[Context compacted: sliding window kept %d recent messages]", len(recent)),
	}, nil
}
