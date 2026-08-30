package loop

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/provider"
)

func TestCanonicalJSON_IgnoresKeyOrderAndSpace(t *testing.T) {
	a := json.RawMessage(`{ "b": 1, "a": "x" }`)
	b := json.RawMessage(`{"a":"x","b":1}`)
	assert.Equal(t, canonicalJSON(a), canonicalJSON(b))
}

func TestIsToolFailure(t *testing.T) {
	assert.True(t, isToolFailure(json.RawMessage(`{"error":"boom"}`)))
	assert.True(t, isToolFailure(json.RawMessage(`{"exit_code":1}`)))
	assert.False(t, isToolFailure(json.RawMessage(`{"exit_code":0}`)))
	assert.False(t, isToolFailure(json.RawMessage(`{"message":"ok"}`)))
	assert.False(t, isToolFailure(json.RawMessage(`{"status":"user_rejected","message":"no"}`)))
	assert.True(t, isToolFailure(json.RawMessage("{\"error\":\"boom\"}\n"+failStreakHint)))
}

func TestToolFailStreak_HintOnThirdIdenticalFailure(t *testing.T) {
	s := &toolFailStreak{}
	args := json.RawMessage(`{"path":"a"}`)
	fail := json.RawMessage(`{"error":"missing"}`)
	got := ""
	for i := 0; i < 3; i++ {
		got = s.annotate("read_file", args, fail, `{"error":"missing"}`)
	}
	assert.Contains(t, got, failStreakHint)
	assert.Equal(t, 3, s.count)
}

func TestToolFailStreak_DifferentArgsReset(t *testing.T) {
	s := &toolFailStreak{}
	fail := json.RawMessage(`{"error":"x"}`)
	s.annotate("read_file", json.RawMessage(`{"path":"a"}`), fail, "")
	s.annotate("read_file", json.RawMessage(`{"path":"a"}`), fail, "")
	got := s.annotate("read_file", json.RawMessage(`{"path":"b"}`), fail, `{"error":"x"}`)
	assert.NotContains(t, got, failStreakHint)
	assert.Equal(t, 1, s.count)
}

func TestToolFailStreak_SuccessResets(t *testing.T) {
	s := &toolFailStreak{}
	fail := json.RawMessage(`{"error":"x"}`)
	ok := json.RawMessage(`{"ok":true}`)
	args := json.RawMessage(`{"path":"a"}`)
	s.annotate("read_file", args, fail, "")
	s.annotate("read_file", args, fail, "")
	s.annotate("read_file", args, ok, "")
	got := s.annotate("read_file", args, fail, `{"error":"x"}`)
	assert.NotContains(t, got, failStreakHint)
	assert.Equal(t, 1, s.count)
}

func TestToolFailStreak_OtherToolBreaksStreak(t *testing.T) {
	s := &toolFailStreak{}
	fail := json.RawMessage(`{"error":"x"}`)
	s.annotate("read_file", json.RawMessage(`{"path":"a"}`), fail, "")
	s.annotate("read_file", json.RawMessage(`{"path":"a"}`), fail, "")
	s.annotate("get_time", json.RawMessage(`{}`), fail, "")
	got := s.annotate("read_file", json.RawMessage(`{"path":"a"}`), fail, `{"error":"x"}`)
	assert.NotContains(t, got, failStreakHint)
}

func TestToolFailStreak_SeedThenThirdGetsHint(t *testing.T) {
	args := json.RawMessage(`{"path":"a"}`)
	fail := `{"error":"missing"}`
	s := &toolFailStreak{}
	s.seed([]provider.Message{
		{Role: provider.RoleAssistant, ToolCalls: []provider.ToolCall{
			{ID: "1", Name: "read_file", Arguments: args},
		}},
		{Role: provider.RoleTool, ToolCallID: "1", Name: "read_file", Content: fail},
		{Role: provider.RoleAssistant, ToolCalls: []provider.ToolCall{
			{ID: "2", Name: "read_file", Arguments: args},
		}},
		{Role: provider.RoleTool, ToolCallID: "2", Name: "read_file", Content: fail},
	})
	require.Equal(t, 2, s.count)
	got := s.annotate("read_file", args, json.RawMessage(fail), fail)
	assert.Contains(t, got, failStreakHint)
}
