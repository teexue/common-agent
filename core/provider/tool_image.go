package provider

import "strings"

// ToolImageUserPrefix marks synthetic user messages that carry tool-produced
// vision blocks. They must stay RoleUser for provider APIs but must not be
// shown as human chat turns in UIs.
const ToolImageUserPrefix = "[image from tool "

// IsToolImageUserMessage reports whether m is a synthetic vision follow-up
// injected after a tool result (not a real user turn).
func IsToolImageUserMessage(m Message) bool {
	return m.Role == RoleUser && strings.HasPrefix(m.Content, ToolImageUserPrefix)
}

// ToolImageUserContent builds the marker text for a tool-produced image turn.
func ToolImageUserContent(toolName string) string {
	return ToolImageUserPrefix + toolName + "]"
}
