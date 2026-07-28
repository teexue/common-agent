package compaction

import (
	"fmt"

	"github.com/teexue/common-agent/core/provider"
)

// TruncationCompactor keeps the system prompt and recent messages, dropping
// older conversation turns until estimated tokens fit under TokenLimit
// (and/or an optional MaxMessages secondary trigger).
type TruncationCompactor struct {
	tokenLimit  int
	maxMessages int
	keepRecent  int
}

// NewTruncationCompactor creates a TruncationCompactor.
func NewTruncationCompactor(tokenLimit, maxMessages, keepRecent int) *TruncationCompactor {
	if keepRecent <= 0 {
		keepRecent = defaultKeepRecent
	}
	return &TruncationCompactor{
		tokenLimit:  tokenLimit,
		maxMessages: maxMessages,
		keepRecent:  keepRecent,
	}
}

// Compact drops older messages until under the token/message thresholds.
// Returns nil if no compaction is needed.
func (c *TruncationCompactor) Compact(messages []provider.Message) (*Result, error) {
	if !NeedsCompactionByTokens(messages, c.tokenLimit) && !NeedsCompaction(messages, c.maxMessages) {
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

	start := 0
	maxStart := len(convMsgs) - c.keepRecent
	if maxStart < 0 {
		maxStart = 0
	}
	for start <= maxStart {
		recent := ensureToolPairs(convMsgs[start:])
		trial := append(append([]provider.Message{}, systemMsgs...), recent...)
		overTokens := c.tokenLimit > 0 && EstimateTokens(trial) > c.tokenLimit
		overMsgs := c.maxMessages > 0 && len(trial) > c.maxMessages
		if !overTokens && !overMsgs {
			break
		}
		if start == maxStart {
			break
		}
		start++
	}

	recent := ensureToolPairs(convMsgs[start:])
	summary := buildTruncationSummary(oldCount, len(systemMsgs)+1+len(recent))
	compacted := make([]provider.Message, 0, len(systemMsgs)+1+len(recent))
	compacted = append(compacted, systemMsgs...)
	compacted = append(compacted, provider.Message{
		Role:    provider.RoleUser,
		Content: summary,
	})
	compacted = append(compacted, recent...)

	return &Result{
		Compacted: compacted,
		OldCount:  oldCount,
		NewCount:  len(compacted),
		Summary:   summary,
	}, nil
}

// ensureToolPairs ensures that tool result messages have a preceding assistant
// message with the matching tool call. Orphaned tool results are removed.
func ensureToolPairs(messages []provider.Message) []provider.Message {
	knownToolCallIDs := make(map[string]bool)
	for _, m := range messages {
		if m.Role == provider.RoleAssistant {
			for _, tc := range m.ToolCalls {
				knownToolCallIDs[tc.ID] = true
			}
		}
	}
	var result []provider.Message
	for _, m := range messages {
		if m.Role == provider.RoleTool {
			if m.ToolCallID != "" && !knownToolCallIDs[m.ToolCallID] {
				continue
			}
		}
		result = append(result, m)
	}
	return result
}

func buildTruncationSummary(oldCount, newCount int) string {
	dropped := oldCount - newCount
	return fmt.Sprintf("[Context compacted: %d older messages removed to stay within context window]", dropped)
}
