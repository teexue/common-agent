package compaction

import (
	"github.com/teexue/common-agent/core/provider"
)

// TruncationCompactor keeps the system prompt and the most recent messages,
// dropping older messages to fit within the context window. Tool result messages
// are kept paired with their corresponding assistant tool-call messages.
type TruncationCompactor struct {
	maxMessages int
	keepRecent  int
}

// NewTruncationCompactor creates a TruncationCompactor.
func NewTruncationCompactor(maxMessages, keepRecent int) *TruncationCompactor {
	return &TruncationCompactor{
		maxMessages: maxMessages,
		keepRecent:  keepRecent,
	}
}

// Compact drops older messages, keeping the system prompt and recent messages.
// Returns nil if no compaction is needed.
func (c *TruncationCompactor) Compact(messages []provider.Message) (*Result, error) {
	if !NeedsCompaction(messages, c.maxMessages) {
		return nil, nil
	}

	oldCount := len(messages)

	// Separate system messages from conversation messages.
	var systemMsgs []provider.Message
	var convMsgs []provider.Message
	for _, m := range messages {
		if m.Role == provider.RoleSystem {
			systemMsgs = append(systemMsgs, m)
		} else {
			convMsgs = append(convMsgs, m)
		}
	}

	// Keep the most recent messages.
	keepCount := c.keepRecent
	if keepCount > len(convMsgs) {
		keepCount = len(convMsgs)
	}

	recent := convMsgs[len(convMsgs)-keepCount:]

	// Ensure tool result messages have their corresponding assistant message.
	recent = ensureToolPairs(recent)

	// Rebuild: system messages + summary + recent.
	compacted := make([]provider.Message, 0, len(systemMsgs)+1+len(recent))
	compacted = append(compacted, systemMsgs...)

	// Add a summary message indicating compaction happened.
	summary := buildTruncationSummary(oldCount, len(systemMsgs)+len(recent))
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
// message with the matching tool call. If a tool result is orphaned (its
// assistant message was truncated), the tool result is also removed.
func ensureToolPairs(messages []provider.Message) []provider.Message {
	// Collect all tool call IDs from assistant messages.
	knownToolCallIDs := make(map[string]bool)
	for _, m := range messages {
		if m.Role == provider.RoleAssistant {
			for _, tc := range m.ToolCalls {
				knownToolCallIDs[tc.ID] = true
			}
		}
	}

	// Filter out orphaned tool results.
	var result []provider.Message
	for _, m := range messages {
		if m.Role == provider.RoleTool {
			if m.ToolCallID != "" && !knownToolCallIDs[m.ToolCallID] {
				continue // orphaned tool result
			}
		}
		result = append(result, m)
	}
	return result
}

func buildTruncationSummary(oldCount, newCount int) string {
	dropped := oldCount - newCount
	return "[Context compacted: " + itoa(dropped) + " older messages removed to stay within context window]"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	if neg {
		s = "-" + s
	}
	return s
}
