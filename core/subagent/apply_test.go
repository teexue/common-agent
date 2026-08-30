package subagent

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/permission"
)

func TestApplyToAgent_InjectsAndAutoApproves(t *testing.T) {
	a := &agent.Agent{
		Name: "p", Tools: []string{"read_file"},
		Permissions: &permission.Permissions{AutoApprove: []string{"read_file"}},
	}
	ApplyToAgent(a, true)
	assert.Contains(t, a.Tools, ToolName)
	assert.Contains(t, a.Permissions.AutoApprove, ToolName)
}

func TestApplyToAgent_DisabledStrips(t *testing.T) {
	a := &agent.Agent{Tools: []string{"read_file", ToolName}}
	ApplyToAgent(a, false)
	assert.Equal(t, []string{"read_file"}, a.Tools)
}

func TestApplyToAgent_RespectsAlwaysDeny(t *testing.T) {
	a := &agent.Agent{
		Tools: []string{},
		Permissions: &permission.Permissions{
			AlwaysDeny: []string{ToolName},
		},
	}
	ApplyToAgent(a, true)
	require.Contains(t, a.Tools, ToolName)
	assert.NotContains(t, a.Permissions.AutoApprove, ToolName)
}
