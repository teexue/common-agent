package subagent

import (
	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/permission"
)

// ToolName is the loop tool used to start a nested run.
const ToolName = "delegate_task"

// ApplyToAgent adds or strips ToolName. enabled is false when globally off
// or when this agent has already reached MaxDepth.
func ApplyToAgent(a *agent.Agent, enabled bool) {
	if a == nil {
		return
	}
	a.Tools = withoutName(a.Tools, ToolName)
	if !enabled {
		return
	}
	a.Tools = append(a.Tools, ToolName)
	approveSubagent(a)
}

func approveSubagent(a *agent.Agent) {
	if a.Permissions == nil {
		return
	}
	if containsName(a.Permissions.AlwaysDeny, ToolName) {
		return
	}
	if containsName(a.Permissions.AutoApprove, ToolName) {
		return
	}
	a.Permissions.AutoApprove = append(a.Permissions.AutoApprove, ToolName)
}

func clonePermissions(src *permission.Permissions) *permission.Permissions {
	if src == nil {
		return nil
	}
	out := *src
	out.AutoApprove = append([]string(nil), src.AutoApprove...)
	out.AlwaysDeny = append([]string(nil), src.AlwaysDeny...)
	return &out
}

func withoutName(names []string, drop string) []string {
	out := make([]string, 0, len(names))
	for _, n := range names {
		if n != drop {
			out = append(out, n)
		}
	}
	return out
}

func containsName(names []string, want string) bool {
	for _, n := range names {
		if n == want {
			return true
		}
	}
	return false
}
