package permission

// AllowAllPolicy permits every tool call without confirmation.
// This is the default behavior when no permissions are configured.
type AllowAllPolicy struct{}

// Check always returns Allow.
func (AllowAllPolicy) Check(_ ToolCall) Decision {
	return Allow
}
