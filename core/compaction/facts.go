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
	c := newFactCollector()
	c.ingest(messages)
	block := c.format()
	if block == "" {
		return ""
	}
	return c.trimToBudget(block, maxChars)
}

type factCollector struct {
	userMsgs  []string
	toolFacts []string
	pathFacts []string
	seenUser  map[string]bool
	seenTool  map[string]bool
	pathSeen  map[string]bool
}

func newFactCollector() *factCollector {
	return &factCollector{
		seenUser: map[string]bool{},
		seenTool: map[string]bool{},
		pathSeen: map[string]bool{},
	}
}

func (c *factCollector) ingest(messages []provider.Message) {
	for i := len(messages) - 1; i >= 0; i-- {
		m := messages[i]
		switch m.Role {
		case provider.RoleUser:
			c.collectUser(m.Content)
		case provider.RoleAssistant:
			c.collectAssistant(m)
		case provider.RoleTool:
			c.collectToolResult(m)
		}
	}
}

func (c *factCollector) collectPaths(s string) {
	if len(c.pathFacts) >= maxPathFacts {
		return
	}
	for _, m := range filePathRe.FindAllString(s, -1) {
		if len(c.pathFacts) >= maxPathFacts {
			break
		}
		key := strings.ToLower(m)
		if c.pathSeen[key] {
			continue
		}
		c.pathSeen[key] = true
		c.pathFacts = append(c.pathFacts, m)
	}
}

func (c *factCollector) collectUser(text string) {
	text = strings.TrimSpace(text)
	if text == "" {
		return
	}
	c.collectPaths(text)
	if c.seenUser[text] || len(c.userMsgs) >= maxUserFacts {
		return
	}
	c.seenUser[text] = true
	c.userMsgs = append(c.userMsgs, truncateRunes(text, maxUserFactRunes))
}

func (c *factCollector) collectAssistant(m provider.Message) {
	for _, tc := range m.ToolCalls {
		if len(c.toolFacts) >= maxToolFacts {
			break
		}
		if c.seenTool[tc.Name] {
			continue
		}
		c.seenTool[tc.Name] = true
		c.toolFacts = append(c.toolFacts, "工具: "+tc.Name)
	}
	c.collectPaths(m.Content)
}

func (c *factCollector) collectToolResult(m provider.Message) {
	c.collectPaths(m.Content)
	if len(c.toolFacts) >= maxToolFacts {
		return
	}
	key := "result:" + m.Name
	if c.seenTool[key] {
		return
	}
	c.seenTool[key] = true
	body := strings.TrimSpace(m.Content)
	if body == "" {
		return
	}
	c.toolFacts = append(c.toolFacts, "工具 "+m.Name+" 返回: "+truncateRunes(body, maxToolFactChars))
}

func (c *factCollector) writeUsers(sb *strings.Builder) {
	for i := len(c.userMsgs) - 1; i >= 0; i-- {
		sb.WriteString("\n用户: ")
		sb.WriteString(c.userMsgs[i])
	}
}

func (c *factCollector) format() string {
	if len(c.userMsgs) == 0 && len(c.pathFacts) == 0 && len(c.toolFacts) == 0 {
		return ""
	}
	var sb strings.Builder
	sb.WriteString(factsMarker)
	c.writeUsers(&sb)
	for _, p := range c.pathFacts {
		sb.WriteString("\n文件: ")
		sb.WriteString(p)
	}
	for i := len(c.toolFacts) - 1; i >= 0; i-- {
		sb.WriteString("\n")
		sb.WriteString(c.toolFacts[i])
	}
	return sb.String()
}

func (c *factCollector) trimToBudget(block string, maxChars int) string {
	if len(block) > maxChars && len(c.toolFacts) > 0 {
		var sb strings.Builder
		sb.WriteString(factsMarker)
		c.writeUsers(&sb)
		for _, p := range c.pathFacts {
			sb.WriteString("\n文件: ")
			sb.WriteString(p)
		}
		block = sb.String()
	}
	if len(block) > maxChars && len(c.pathFacts) > 0 {
		var sb strings.Builder
		sb.WriteString(factsMarker)
		c.writeUsers(&sb)
		block = sb.String()
	}
	if len(block) > maxChars {
		block = truncateTailBytes(block, maxChars)
	}
	return block
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
