package loop

// maxToolResultBytes caps how much of a tool output is kept in session history.
// Large outputs (command dumps, big files, web pages) are otherwise re-sent in
// full on every subsequent turn, which dominates input token usage.
const maxToolResultBytes = 16 * 1024 // 16 KB per tool result

// minToolResultBytes is the floor when context pressure is high: keep at least
// a sliver so the model still sees what the tool produced.
const minToolResultBytes = 4 * 1024 // 4 KB per tool result

// truncateToolOutput keeps the head and tail of an oversized tool output: the
// beginning usually shows what ran, and the tail carries errors/exit context —
// the parts that matter most for the next turn.
func truncateToolOutput(s string) string {
	return truncateToolOutputBudget(s, maxToolResultBytes)
}

// truncateToolOutputBudget is the pressure-aware variant: it trims oversized
// tool output to budget bytes (head + tail), so chatty results shrink as the
// context window fills and delay the next compaction.
func truncateToolOutputBudget(s string, budget int) string {
	if budget <= 0 {
		return s
	}
	if len(s) <= budget {
		return s
	}
	const marker = "\n...[tool output truncated]...\n"
	headLen := budget/2 - len(marker)/2
	tailLen := budget - headLen - len(marker)
	if headLen < 0 {
		headLen = 0
	}
	if tailLen < 0 {
		tailLen = 0
	}
	return s[:headLen] + marker + s[len(s)-tailLen:]
}

// toolResultBudget returns the per-tool-result byte budget for a given
// context-pressure ratio (usage / window). It shrinks from maxToolResultBytes
// at pressure 0.6 down to minToolResultBytes near full, so verbose outputs are
// slimmed progressively as the window fills.
func toolResultBudget(pressure float64) int {
	const lo = 0.6
	switch {
	case pressure <= lo:
		return maxToolResultBytes
	case pressure >= 1:
		return minToolResultBytes
	}
	span := float64(maxToolResultBytes - minToolResultBytes)
	budget := maxToolResultBytes - int((pressure-lo)/(1-lo)*span)
	if budget < minToolResultBytes {
		return minToolResultBytes
	}
	return budget
}
