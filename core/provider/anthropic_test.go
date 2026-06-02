package provider

import (
	"encoding/json"
	"testing"
)

func TestAnthropicBuildRequest(t *testing.T) {
	a, err := NewAnthropic(AnthropicConfig{APIKey: "test"})
	if err != nil {
		t.Fatal(err)
	}

	req := Request{
		Model: "claude-sonnet-4-20250514",
		Messages: []Message{
			{Role: RoleSystem, Content: "system prompt"},
			{Role: RoleUser, Content: "hello"},
			{
				Role:    RoleAssistant,
				Content: "calling tool",
				ToolCalls: []ToolCall{{
					ID: "toolu_1", Name: "echo", Arguments: json.RawMessage(`{"message":"hi"}`),
				}},
			},
			{Role: RoleTool, ToolCallID: "toolu_1", Content: `{"message":"hi"}`},
		},
		Tools: []ToolDefinition{{
			Name: "echo", Description: "echo", Parameters: map[string]any{"type": "object"},
		}},
	}

	body := a.buildRequest(req)
	if body.System != "system prompt" {
		t.Fatalf("system = %q", body.System)
	}
	if len(body.Messages) != 3 {
		t.Fatalf("messages = %d, want 3", len(body.Messages))
	}
	if body.Messages[1].Role != "assistant" {
		t.Fatalf("assistant role = %q", body.Messages[1].Role)
	}
	if body.Messages[1].Content[1].Type != "tool_use" {
		t.Fatalf("expected tool_use block")
	}
	if body.Messages[2].Content[0].Type != "tool_result" {
		t.Fatalf("expected tool_result block")
	}
}

func TestNewAnthropicRequiresAPIKey(t *testing.T) {
	if _, err := NewAnthropic(AnthropicConfig{}); err == nil {
		t.Fatal("expected error")
	}
}
