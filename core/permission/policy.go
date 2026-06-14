// Package permission defines the Policy interface for tool execution authorization.
// Policies determine whether a tool call is allowed, denied, or requires user confirmation.
package permission

// Decision represents the tri-state outcome of a policy check.
type Decision string

const (
	// Allow permits the tool to execute without user interaction.
	Allow Decision = "allow"
	// Deny blocks the tool from executing. The tool call returns a permission error.
	Deny Decision = "deny"
	// Confirm requires user approval before the tool can execute.
	// The caller (CLI or HTTP) is responsible for prompting the user.
	Confirm Decision = "confirm"
)

// ToolCall is a minimal description of a tool invocation for policy evaluation.
type ToolCall struct {
	Name      string
	Arguments []byte
}

// Policy evaluates whether a tool call is permitted.
// Implementations must be safe for concurrent use.
type Policy interface {
	// Check returns the Decision for the given tool call.
	Check(call ToolCall) Decision
}
