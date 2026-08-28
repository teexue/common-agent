package compaction

import (
	"context"
	"strconv"
	"strings"

	"github.com/teexue/common-agent/core/provider"
)

// TruncationCompactor keeps the system prompt, a small stable head, and recent
// conversation turns, dropping older turns until estimated tokens fit under
// TokenLimit (and/or an optional MaxMessages secondary trigger). Dropped turns
// are reduced to a key-facts block (see ExtractFacts) instead of being
// discarded entirely, and the head is preserved so the prompt prefix stays
// stable for provider-side prompt caching.
type TruncationCompactor struct {
	tokenLimit    int
	maxMessages   int
	keepRecent    int
	keepHead      int
	currentTokens int
	// targetTokens is the post-compaction budget. fits() compresses down to
	// this level instead of tokenLimit, leaving headroom so compaction does
	// not re-fire on the next turn. 0 falls back to tokenLimit.
	targetTokens int
}

// NewTruncationCompactor creates a TruncationCompactor with the default head.
func NewTruncationCompactor(tokenLimit, maxMessages, keepRecent int) *TruncationCompactor {
	return NewTruncationCompactorWithHead(tokenLimit, maxMessages, keepRecent, defaultKeepHead)
}

// NewTruncationCompactorWithHead creates a TruncationCompactor with an explicit
// head size.
func NewTruncationCompactorWithHead(tokenLimit, maxMessages, keepRecent, keepHead int) *TruncationCompactor {
	if keepRecent <= 0 {
		keepRecent = defaultKeepRecent
	}
	if keepHead < 0 {
		keepHead = 0
	}
	return &TruncationCompactor{
		tokenLimit:  tokenLimit,
		maxMessages: maxMessages,
		keepRecent:  keepRecent,
		keepHead:    keepHead,
	}
}

// currentUsage returns the known token usage when available, falling back to
// the estimate.
func (c *TruncationCompactor) currentUsage(messages []provider.Message) int {
	if c.currentTokens > 0 {
		return c.currentTokens
	}
	return EstimateTokens(messages)
}

// trialTokens estimates the token usage of a candidate message list. When a
// known usage is available it scales the estimate by the same ratio, keeping
// the trial consistent with the real tokenizer (important for CJK-heavy
// conversations where raw estimates can drift).
func (c *TruncationCompactor) trialTokens(trial, messages []provider.Message) int {
	est := EstimateTokens(trial)
	if c.currentTokens > 0 {
		if base := EstimateTokens(messages); base > 0 {
			return int(float64(c.currentTokens) * float64(est) / float64(base))
		}
	}
	return est
}

// Compact drops older messages until under the token/message thresholds.
// Returns nil if no compaction is needed.
func (c *TruncationCompactor) Compact(ctx context.Context, messages []provider.Message) (*Result, error) {
	if !NeedsCompactionByTokensCount(c.currentUsage(messages), c.tokenLimit) && !NeedsCompaction(messages, c.maxMessages) {
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

	// Separate prior facts blocks so they are neither re-summarized as noise
	// nor silently dropped: their content is merged into the new facts so
	// key context survives across repeated compactions.
	var priorFacts []string
	var nonFacts []provider.Message
	for _, m := range convMsgs {
		if m.Role == provider.RoleUser && strings.HasPrefix(m.Content, factsMarker) {
			priorFacts = append(priorFacts, strings.TrimPrefix(m.Content, factsMarker))
			continue
		}
		nonFacts = append(nonFacts, m)
	}

	head, middle, recent := splitHeadMiddleRecent(nonFacts, c.keepHead, c.keepRecent)
	fullMiddle := append([]provider.Message{}, middle...)
	fullHead := append([]provider.Message{}, head...)
	recent = ensureToolPairs(recent)

	// fits reports whether system + head + middle + recent is under both the
	// post-compaction target budget (so compaction leaves headroom) and the
	// optional message-count threshold. The target is below the trigger line
	// to avoid re-firing compaction on the very next turn.
	fits := func(h, m []provider.Message) bool {
		trial := make([]provider.Message, 0, len(systemMsgs)+len(h)+len(m)+len(recent))
		trial = append(trial, systemMsgs...)
		trial = append(trial, h...)
		trial = append(trial, m...)
		trial = append(trial, recent...)
		budget := c.targetTokens
		if budget <= 0 {
			budget = c.tokenLimit
		}
		overTokens := budget > 0 && c.trialTokens(trial, messages) > budget
		overMsgs := c.maxMessages > 0 && len(trial) > c.maxMessages
		return !overTokens && !overMsgs
	}

	// Progressive drop: first remove old tool turn pairs (assistant tool call
	// + matching tool result) so plain dialog survives, then drop the oldest
	// remaining middle messages, and only as a last resort the head.
	middle = dropToolTurnPairs(middle, func(m []provider.Message) bool { return fits(head, m) })
	middle = dropOldestUntilFit(middle, func(m []provider.Message) bool { return fits(head, m) })
	head = dropOldestUntilFit(head, func(h []provider.Message) bool { return fits(h, middle) })

	keptConv := make([]provider.Message, 0, len(head)+len(middle)+len(recent))
	keptConv = append(keptConv, head...)
	keptConv = append(keptConv, middle...)
	keptConv = append(keptConv, recent...)
	keptConv = ensureToolPairs(keptConv)

	// Facts describe everything that did not survive: the full middle segment
	// plus any head messages dropped by the last-resort head trimming.
	droppedHead := fullHead[:len(fullHead)-len(head)]
	factsInput := make([]provider.Message, 0, len(fullMiddle)+len(droppedHead))
	factsInput = append(factsInput, fullMiddle...)
	factsInput = append(factsInput, droppedHead...)
	facts := ExtractFacts(factsInput, defaultFactsMaxChars)
	facts = mergeFacts(priorFacts, facts, defaultFactsMaxChars)
	if facts == "" {
		facts = buildTruncationSummary(oldCount, len(systemMsgs)+len(keptConv))
	}

	compacted := make([]provider.Message, 0, len(systemMsgs)+1+len(keptConv))
	compacted = append(compacted, systemMsgs...)
	compacted = append(compacted, head...)
	compacted = append(compacted, provider.Message{Role: provider.RoleUser, Content: facts})
	compacted = append(compacted, middle...)
	compacted = append(compacted, recent...)

	return &Result{
		Compacted: compacted,
		OldCount:  oldCount,
		NewCount:  len(compacted),
		Summary:   facts,
	}, nil
}

// splitHeadMiddleRecent partitions conversation messages into the oldest head
// segment (stable prefix), a droppable middle, and the recent tail.
func splitHeadMiddleRecent(conv []provider.Message, keepHead, keepRecent int) (head, middle, recent []provider.Message) {
	if keepHead < 0 {
		keepHead = 0
	}
	if keepRecent <= 0 {
		keepRecent = defaultKeepRecent
	}
	if keepHead > len(conv) {
		keepHead = len(conv)
	}
	recentStart := len(conv) - keepRecent
	if recentStart < keepHead {
		recentStart = keepHead
	}
	return conv[:keepHead], conv[keepHead:recentStart], conv[recentStart:]
}

// dropToolTurnPairs removes the oldest assistant tool-call + matching tool
// result pairs from msgs until ok(msgs) returns true or no pairs remain.
func dropToolTurnPairs(msgs []provider.Message, ok func([]provider.Message) bool) []provider.Message {
	for {
		if ok(msgs) {
			return msgs
		}
		callIdx, resultIdx := findOldestToolPair(msgs)
		if callIdx < 0 {
			return msgs
		}
		msgs = removeIndices(msgs, callIdx, resultIdx)
	}
}

// findOldestToolPair locates the oldest assistant message with tool calls and
// the index of its first matching tool result (or -1 when no result exists).
func findOldestToolPair(msgs []provider.Message) (callIdx, resultIdx int) {
	resultIdx = -1
	for i := range msgs {
		m := msgs[i]
		if m.Role != provider.RoleAssistant || len(m.ToolCalls) == 0 {
			continue
		}
		callIdx = i
		for _, tc := range m.ToolCalls {
			for j := i + 1; j < len(msgs); j++ {
				if msgs[j].Role == provider.RoleTool && msgs[j].ToolCallID == tc.ID {
					resultIdx = j
					return callIdx, resultIdx
				}
			}
		}
		// Tool call without a matching result: drop the call alone.
		return callIdx, -1
	}
	return -1, -1
}

// dropOldestUntilFit drops the oldest messages until ok(msgs) or msgs is empty.
func dropOldestUntilFit(msgs []provider.Message, ok func([]provider.Message) bool) []provider.Message {
	for len(msgs) > 0 && !ok(msgs) {
		msgs = msgs[1:]
	}
	return msgs
}

// removeIndices returns msgs without the element at idx (and resultIdx when
// >= 0).
func removeIndices(msgs []provider.Message, idx, resultIdx int) []provider.Message {
	out := make([]provider.Message, 0, len(msgs)-1)
	for i, m := range msgs {
		if i == idx || i == resultIdx {
			continue
		}
		out = append(out, m)
	}
	return out
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
	return "[Context compacted: " + strconv.Itoa(dropped) + " older messages removed to stay within context window]"
}

// mergeFacts folds prior facts blocks into a freshly extracted one so key
// context survives repeated compactions. Prior blocks are kept as a
// "[历史保留]" prefix; the combined block is bounded by maxChars, keeping
// the newest content when it overflows.
func mergeFacts(prior []string, fresh string, maxChars int) string {
	if len(prior) == 0 {
		return fresh
	}
	var sb strings.Builder
	sb.WriteString(factsMarker)
	sb.WriteString("\n[历史保留]\n")
	for _, p := range prior {
		t := strings.TrimSpace(p)
		if t != "" {
			sb.WriteString(t)
			sb.WriteByte('\n')
		}
	}
	if fresh != "" {
		sb.WriteString(strings.TrimSpace(strings.TrimPrefix(fresh, factsMarker)))
	}
	out := sb.String()
	if maxChars > 0 && len(out) > maxChars {
		out = truncateTailBytes(out, maxChars)
	}
	return out
}
