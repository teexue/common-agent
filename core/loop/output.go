package loop

// maxToolResultBytes caps how much of a tool output is kept in session history.
// Large outputs (command dumps, big files, web pages) are otherwise re-sent in
// full on every subsequent turn, which dominates input token usage.
const maxToolResultBytes = 16 * 1024 // 16 KB per tool result

// truncateToolOutput keeps the head and tail of an oversized tool output: the
// beginning usually shows what ran, and the tail carries errors/exit context —
// the parts that matter most for the next turn.
func truncateToolOutput(s string) string {
	if len(s) <= maxToolResultBytes {
		return s
	}
	const marker = "\n...[tool output truncated]...\n"
	headLen := maxToolResultBytes/2 - len(marker)/2
	tailLen := maxToolResultBytes - headLen - len(marker)
	return s[:headLen] + marker + s[len(s)-tailLen:]
}
