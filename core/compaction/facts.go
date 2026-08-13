package compaction

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/teexue/common-agent/core/provider"
)

// Facts markers and limits. The facts block is inserted as a single user
// message in place of dropped history; it must stay small.
const (
	factsMarker          = "[保留的关键上下文]"
	defaultFactsMaxChars = 1500
	maxUserFactRunes     = 200
	maxToolFactChars     = 120
	maxToolFacts         = 8
	maxPathFacts         = 6
	maxUserFacts         = 3
)

// filePathRe matches common absolute and relative file paths (POSIX and
// Windows). It is deliberately conservative to avoid picking up prose.
var filePathRe = regexp.MustCompile(`(?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|/)?[\w@.+-]+(?:[\\/][\w@.+-]+){1,}(?:\.[A-Za-z0-9]+)?`)

// ExtractFacts builds a compact key-facts block from conversation messages
// that compaction is about to drop. It is pure heuristics (no LLM call):
// recent user intents, tool invocations, and file paths carry the most value
// for continued work, so they are preserved instead of being discarded with
// the raw history.
func ExtractFacts(messages []provider.Message, maxChars int) string {
	if maxChars <= 0 {
		maxChars = defaultFactsMaxChars
	}

	var userMsgs []string
	var toolFacts []string
	seenUser := map[string]bool{}
	seenTool := map[string]bool{}
	pathSeen := map[string]bool{}
	var pathFacts []string

	// Walk from newest to oldest so the most recent intents win the limited
	// space, then reverse for chronological display.
	collectPaths := func(s string) {
		if len(pathFacts) >= maxPathFacts {
			return
		}
		for _, m := range filePathRe.FindAllString(s, -1) {
			if len(pathFacts) >= maxPathFacts {
				break
			}
			key := strings.ToLower(m)
			if pathSeen[key] {
				continue
			}
			pathSeen[key] = true
			pathFacts = append(pathFacts, m)
		}
	}

	for i := len(messages) - 1; i >= 0; i-- {
		m := messages[i]
		switch m.Role {
		case provider.RoleUser:
			text := strings.TrimSpace(m.Content)
			if text == "" {
				continue
			}
			collectPaths(text)
			if seenUser[text] || len(userMsgs) >= maxUserFacts {
				continue
			}
			seenUser[text] = true
			userMsgs = append(userMsgs, truncateRunes(text, maxUserFactRunes))
		case provider.RoleAssistant:
			if len(m.ToolCalls) > 0 {
				for _, tc := range m.ToolCalls {
					if len(toolFacts) >= maxToolFacts {
						break
					}
					key := tc.Name
					if seenTool[key] {
						continue
					}
					seenTool[key] = true
					toolFacts = append(toolFacts, "工具: "+tc.Name)
				}
			}
			collectPaths(m.Content)
		case provider.RoleTool:
			collectPaths(m.Content)
			if len(toolFacts) >= maxToolFacts {
				continue
			}
			key := "result:" + m.Name
			if seenTool[key] {
				continue
			}
			seenTool[key] = true
			body := strings.TrimSpace(m.Content)
			if body == "" {
				continue
			}
			toolFacts = append(toolFacts, "工具 "+m.Name+" 返回: "+truncateRunes(body, maxToolFactChars))
		}
	}

	var sb strings.Builder
	if len(userMsgs) == 0 && len(pathFacts) == 0 && len(toolFacts) == 0 {
		return ""
	}
	sb.WriteString(factsMarker)
	// Newest first, then reversed to chronological order.
	for i := len(userMsgs) - 1; i >= 0; i-- {
		sb.WriteString("\n用户: ")
		sb.WriteString(userMsgs[i])
	}
	for _, p := range pathFacts {
		sb.WriteString("\n文件: ")
		sb.WriteString(p)
	}
	for i := len(toolFacts) - 1; i >= 0; i-- {
		sb.WriteString("\n")
		sb.WriteString(toolFacts[i])
	}

	// If over budget, drop whole groups in priority order — tool results
	// first, then paths — before truncating the most valuable user intents.
	userBlock := sb.String()
	if len(userBlock) > maxChars && len(toolFacts) > 0 {
		sb.Reset()
		sb.WriteString(factsMarker)
		for i := len(userMsgs) - 1; i >= 0; i-- {
			sb.WriteString("\n用户: ")
			sb.WriteString(userMsgs[i])
		}
		for _, p := range pathFacts {
			sb.WriteString("\n文件: ")
			sb.WriteString(p)
		}
		userBlock = sb.String()
	}
	if len(userBlock) > maxChars && len(pathFacts) > 0 {
		sb.Reset()
		sb.WriteString(factsMarker)
		for i := len(userMsgs) - 1; i >= 0; i-- {
			sb.WriteString("\n用户: ")
			sb.WriteString(userMsgs[i])
		}
		userBlock = sb.String()
	}
	if len(userBlock) > maxChars {
		// Keep the newest content: user intents are appended chronologically,
		// so the tail holds the most recent instructions. Budget is in bytes.
		userBlock = truncateTailBytes(userBlock, maxChars)
	}
	return userBlock
}

// truncateRunes returns s truncated to at most max runes (with an ellipsis
// when truncated), keeping the head.
func truncateRunes(s string, max int) string {
	if max <= 0 {
		return ""
	}
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	runes := []rune(s)
	if max <= 1 {
		return "…"
	}
	return string(runes[:max-1]) + "…"
}

// truncateTailBytes returns the tail of s bounded by max bytes, keeping the
// newest content (used when facts exceed their budget).
func truncateTailBytes(s string, max int) string {
	if max <= 0 {
		return ""
	}
	if len(s) <= max {
		return s
	}
	runes := []rune(s)
	var tail []rune
	budget := max - len("…")
	for i := len(runes) - 1; i >= 0 && budget > 0; i-- {
		sz := utf8.RuneLen(runes[i])
		if sz > budget {
			break
		}
		tail = append([]rune{runes[i]}, tail...)
		budget -= sz
	}
	return "…" + string(tail)
}
