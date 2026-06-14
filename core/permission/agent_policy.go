package permission

// Permissions configures tool-level permission rules for an agent.
type Permissions struct {
	AutoApprove []string `yaml:"auto_approve" json:"auto_approve,omitempty"`
	AlwaysDeny  []string `yaml:"always_deny" json:"always_deny,omitempty"`
}

// AgentPolicy implements Policy based on agent-level allow/deny lists.
// Tools in AutoApprove are always allowed; tools in AlwaysDeny are always denied.
// All other tools require confirmation.
type AgentPolicy struct {
	autoApprove map[string]bool
	alwaysDeny  map[string]bool
}

// NewAgentPolicy creates an AgentPolicy from a Permissions config.
func NewAgentPolicy(p Permissions) *AgentPolicy {
	sp := &AgentPolicy{
		autoApprove: make(map[string]bool, len(p.AutoApprove)),
		alwaysDeny:  make(map[string]bool, len(p.AlwaysDeny)),
	}
	for _, name := range p.AutoApprove {
		sp.autoApprove[name] = true
	}
	for _, name := range p.AlwaysDeny {
		sp.alwaysDeny[name] = true
	}
	return sp
}

// Check evaluates the tool call against the allow/deny lists.
func (sp *AgentPolicy) Check(call ToolCall) Decision {
	if sp.autoApprove[call.Name] {
		return Allow
	}
	if sp.alwaysDeny[call.Name] {
		return Deny
	}
	return Confirm
}
