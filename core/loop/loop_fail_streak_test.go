package loop_test

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tool"
	"github.com/teexue/common-agent/tools/registry"
)

type boomTool struct{}

func (boomTool) Name() string        { return "boom" }
func (boomTool) Description() string { return "always fails" }
func (boomTool) InputSchema() map[string]any {
	return map[string]any{"type": "object", "properties": map[string]any{}}
}
func (boomTool) Execute(_ context.Context, _ json.RawMessage) (tool.Result, error) {
	return tool.Result{}, fmt.Errorf("boom")
}

func boomAgent() *agent.Agent {
	return &agent.Agent{
		Name: "test", Provider: "mock", Model: "mock",
		SystemPrompt: "test", Tools: []string{"boom"}, MaxTurns: 8,
	}
}

func TestRun_IdenticalToolFailStreakHintsOnThird(t *testing.T) {
	reg := registry.New()
	reg.MustRegister(boomTool{})
	args, _ := json.Marshal(map[string]string{"path": "a"})
	call := provider.ToolCall{ID: "c1", Name: "boom", Arguments: args}
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{ToolCalls: []provider.ToolCall{call}}},
			{{ToolCalls: []provider.ToolCall{{ID: "c2", Name: "boom", Arguments: args}}}},
			{{ToolCalls: []provider.ToolCall{{ID: "c3", Name: "boom", Arguments: args}}}},
			{{Text: "done"}},
		},
	}
	sess := session.New("test")
	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock, Registry: reg, Agent: boomAgent(), Session: sess, Prompt: "go",
	})
	require.NoError(t, err)
	for range events {
	}

	var toolMsgs []string
	for _, m := range sess.GetMessages() {
		if m.Role == provider.RoleTool {
			toolMsgs = append(toolMsgs, m.Content)
		}
	}
	require.Len(t, toolMsgs, 3)
	assert.False(t, strings.Contains(toolMsgs[0], "identical arguments"))
	assert.False(t, strings.Contains(toolMsgs[1], "identical arguments"))
	assert.Contains(t, toolMsgs[2], "identical arguments")
	assert.Contains(t, toolMsgs[2], "different")
}

func TestRun_DifferentArgsDoNotHint(t *testing.T) {
	reg := registry.New()
	reg.MustRegister(boomTool{})
	a1, _ := json.Marshal(map[string]string{"path": "a"})
	a2, _ := json.Marshal(map[string]string{"path": "b"})
	a3, _ := json.Marshal(map[string]string{"path": "c"})
	mock := &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{ToolCalls: []provider.ToolCall{{ID: "1", Name: "boom", Arguments: a1}}}},
			{{ToolCalls: []provider.ToolCall{{ID: "2", Name: "boom", Arguments: a2}}}},
			{{ToolCalls: []provider.ToolCall{{ID: "3", Name: "boom", Arguments: a3}}}},
			{{Text: "done"}},
		},
	}
	sess := session.New("test")
	events, err := loop.Run(context.Background(), loop.Config{
		Provider: mock, Registry: reg, Agent: boomAgent(), Session: sess, Prompt: "go",
	})
	require.NoError(t, err)
	for range events {
	}
	for _, m := range sess.GetMessages() {
		if m.Role == provider.RoleTool {
			assert.NotContains(t, m.Content, "identical arguments")
		}
	}
}
