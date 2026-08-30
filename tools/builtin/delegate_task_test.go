package builtin_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tool"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func TestDelegateTask_RequiresSpawn(t *testing.T) {
	res, err := builtin.DelegateTask{}.Execute(context.Background(), json.RawMessage(`{"task":"hi"}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not configured")
	assert.Equal(t, tool.Result{}, res)
}

func TestDelegateTask_RunsSubAgent(t *testing.T) {
	reg := registry.New()
	parent := &agent.Agent{
		ID: "agt", Name: "parent", Provider: "mock", Model: "m",
		SystemPrompt: "parent", MaxTurns: 3, MaxTokens: 128,
	}
	sess := session.NewForUser("agt", "usr")
	ctx := loop.WithSpawn(context.Background(), loop.Spawn{
		Registry:    reg,
		NewProvider: func(*agent.Agent) (provider.Provider, error) {
			return &provider.MockProvider{
				Calls: [][]provider.MockStep{{{Text: "ok"}}},
			}, nil
		},
		Policy:      permission.AllowAllPolicy{},
		Agent:       parent,
		UserID:      "usr",
		SessionID:   sess.ID,
	})
	ctx = loop.WithParentEventChan(ctx, make(chan event.Event, 8))

	res, err := builtin.DelegateTask{}.Execute(ctx, json.RawMessage(`{"task":"summarize this"}`))
	require.NoError(t, err)
	var out map[string]any
	require.NoError(t, json.Unmarshal(res.Output, &out))
	assert.Equal(t, "ok", out["response"])
	assert.Equal(t, "completed", out["status"])
	assert.NotEmpty(t, out["session_id"])
}

func TestDelegateTask_ChildCannotNest(t *testing.T) {
	reg := registry.New()
	parent := &agent.Agent{
		ID: "agt", Name: "parent", Provider: "mock", Model: "m",
		SystemPrompt: "parent", MaxTurns: 3, MaxTokens: 128,
	}
	ctx := loop.WithSpawn(context.Background(), loop.Spawn{
		Registry:    reg,
		NewProvider: func(*agent.Agent) (provider.Provider, error) {
			return &provider.MockProvider{
				Calls: [][]provider.MockStep{{{Text: "ok"}}},
			}, nil
		},
		Policy: permission.AllowAllPolicy{},
		Agent:  parent,
		Depth:  1,
		Subagent: loop.SubagentLimits{
			Enabled: true, MaxTurns: 5, MaxDepth: 1,
		},
	})
	ctx = loop.WithParentEventChan(ctx, make(chan event.Event, 8))
	_, err := builtin.DelegateTask{}.Execute(ctx, json.RawMessage(`{"task":"nested"}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "depth limit")
}
