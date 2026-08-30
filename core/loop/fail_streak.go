package loop

import (
	"bytes"
	"encoding/json"

	"github.com/teexue/common-agent/core/provider"
)

const failStreakLimit = 3

const failStreakHint = "This tool has failed 3 consecutive times with identical arguments. Do not retry this exact call. Switch to a different tool, change the arguments, or ask the user."

type toolFailStreak struct {
	key   string
	count int
}

func (s *toolFailStreak) seed(msgs []provider.Message) {
	calls := map[string]provider.ToolCall{}
	for _, m := range msgs {
		switch m.Role {
		case provider.RoleAssistant:
			for _, c := range m.ToolCalls {
				calls[c.ID] = c
			}
		case provider.RoleTool:
			s.apply(toolNameAndArgs(calls, m))
		}
	}
}

func (s *toolFailStreak) annotate(name string, args, output json.RawMessage, content string) string {
	s.apply(name, args, output)
	if s.count < failStreakLimit {
		return content
	}
	return content + "\n" + failStreakHint
}

func (s *toolFailStreak) apply(name string, args, output json.RawMessage) {
	if !isToolFailure(output) {
		s.key, s.count = "", 0
		return
	}
	key := toolFailKey(name, args)
	if key != s.key {
		s.key, s.count = key, 1
		return
	}
	s.count++
}

func toolNameAndArgs(calls map[string]provider.ToolCall, m provider.Message) (string, json.RawMessage, json.RawMessage) {
	name, args := m.Name, json.RawMessage(nil)
	if c, ok := calls[m.ToolCallID]; ok {
		if name == "" {
			name = c.Name
		}
		args = c.Arguments
	}
	return name, args, json.RawMessage(m.Content)
}

func toolFailKey(name string, args json.RawMessage) string {
	return name + "\x00" + canonicalJSON(args)
}

func canonicalJSON(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return string(raw)
	}
	b, err := json.Marshal(v)
	if err != nil {
		return string(raw)
	}
	return string(b)
}

func isToolFailure(output json.RawMessage) bool {
	var m map[string]any
	if err := json.NewDecoder(bytes.NewReader(output)).Decode(&m); err != nil {
		return false
	}
	if status, _ := m["status"].(string); status == "user_rejected" {
		return false
	}
	if errVal, ok := m["error"]; ok && errVal != nil && errVal != "" {
		return true
	}
	code, ok := m["exit_code"]
	if !ok {
		return false
	}
	n, ok := code.(float64)
	return ok && n != 0
}
