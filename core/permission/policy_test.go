package permission_test

import (
	"testing"

	"github.com/teexue/common-agent/core/permission"
)

func TestAllowAllPolicy(t *testing.T) {
	pol := permission.AllowAllPolicy{}
	decision := pol.Check(permission.ToolCall{Name: "any_tool"})
	if decision != permission.Allow {
		t.Fatalf("expected Allow, got %s", decision)
	}
}

func TestAgentPolicy_AutoApprove(t *testing.T) {
	pol := permission.NewAgentPolicy(permission.Permissions{
		AutoApprove: []string{"echo", "get_time"},
	})

	tests := []struct {
		tool   string
		expect permission.Decision
	}{
		{"echo", permission.Allow},
		{"get_time", permission.Allow},
		{"unknown_tool", permission.Confirm},
	}

	for _, tt := range tests {
		t.Run(tt.tool, func(t *testing.T) {
			decision := pol.Check(permission.ToolCall{Name: tt.tool})
			if decision != tt.expect {
				t.Fatalf("tool %s: expected %s, got %s", tt.tool, tt.expect, decision)
			}
		})
	}
}

func TestAgentPolicy_AlwaysDeny(t *testing.T) {
	pol := permission.NewAgentPolicy(permission.Permissions{
		AlwaysDeny: []string{"dangerous_tool"},
	})

	tests := []struct {
		tool   string
		expect permission.Decision
	}{
		{"dangerous_tool", permission.Deny},
		{"safe_tool", permission.Confirm},
	}

	for _, tt := range tests {
		t.Run(tt.tool, func(t *testing.T) {
			decision := pol.Check(permission.ToolCall{Name: tt.tool})
			if decision != tt.expect {
				t.Fatalf("tool %s: expected %s, got %s", tt.tool, tt.expect, decision)
			}
		})
	}
}

func TestAgentPolicy_BothLists(t *testing.T) {
	pol := permission.NewAgentPolicy(permission.Permissions{
		AutoApprove: []string{"echo"},
		AlwaysDeny:  []string{"rm"},
	})

	tests := []struct {
		tool   string
		expect permission.Decision
	}{
		{"echo", permission.Allow},
		{"rm", permission.Deny},
		{"unknown", permission.Confirm},
	}

	for _, tt := range tests {
		t.Run(tt.tool, func(t *testing.T) {
			decision := pol.Check(permission.ToolCall{Name: tt.tool})
			if decision != tt.expect {
				t.Fatalf("tool %s: expected %s, got %s", tt.tool, tt.expect, decision)
			}
		})
	}
}

func TestAgentPolicy_EmptyLists(t *testing.T) {
	pol := permission.NewAgentPolicy(permission.Permissions{})

	decision := pol.Check(permission.ToolCall{Name: "any_tool"})
	if decision != permission.Confirm {
		t.Fatalf("expected Confirm for empty lists, got %s", decision)
	}
}
