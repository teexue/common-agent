package provider

import (
	"encoding/json"
	"testing"
)

func TestOpenAIBuildRequestWithThinking(t *testing.T) {
	o, err := NewOpenAI(OpenAIConfig{
		APIKey:   "test",
		Thinking: &ThinkingConfig{Type: "disabled"},
	})
	if err != nil {
		t.Fatal(err)
	}

	body := o.buildRequest(Request{
		Model: "kimi-k2.6",
		Messages: []Message{
			{Role: RoleUser, Content: "hi"},
		},
	})
	if body.Thinking == nil || body.Thinking.Type != "disabled" {
		t.Fatalf("thinking = %#v", body.Thinking)
	}
}

func TestOpenAIBuildRequestPreservesReasoningContent(t *testing.T) {
	o, err := NewOpenAI(OpenAIConfig{APIKey: "test"})
	if err != nil {
		t.Fatal(err)
	}

	body := o.buildRequest(Request{
		Model: "kimi-k2.6",
		Messages: []Message{
			{Role: RoleUser, Content: "time?"},
			{
				Role:             RoleAssistant,
				ReasoningContent: "need get_time tool",
				Content:          "",
				ToolCalls: []ToolCall{{
					ID: "1", Name: "get_time", Arguments: json.RawMessage("{}"),
				}},
			},
		},
	})
	if len(body.Messages) != 2 {
		t.Fatalf("messages = %d", len(body.Messages))
	}
	if body.Messages[1].ReasoningContent != "need get_time tool" {
		t.Fatalf("reasoning_content = %q", body.Messages[1].ReasoningContent)
	}
}
