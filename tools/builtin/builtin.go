package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/teexue/common-agent/core/tool"
	"github.com/teexue/common-agent/tools/registry"
)

// Echo repeats the input message.
type Echo struct{}

func (Echo) Name() string        { return "echo" }
func (Echo) Description() string { return "Echo back the provided message." }
func (Echo) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"message": map[string]any{"type": "string", "description": "Message to echo"},
		},
		"required": []string{"message"},
	}
}

func (Echo) Execute(_ context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse echo input: %w", err)
	}
	out, _ := json.Marshal(map[string]string{"message": args.Message})
	return tool.Result{Output: out}, nil
}

// GetTime returns the current UTC time.
type GetTime struct{}

func (GetTime) Name() string        { return "get_time" }
func (GetTime) Description() string { return "Return the current UTC time in RFC3339 format." }
func (GetTime) InputSchema() map[string]any {
	return map[string]any{
		"type":       "object",
		"properties": map[string]any{},
	}
}

func (GetTime) Execute(_ context.Context, _ json.RawMessage) (tool.Result, error) {
	out, _ := json.Marshal(map[string]string{"time": time.Now().UTC().Format(time.RFC3339)})
	return tool.Result{Output: out}, nil
}

// RegisterAll registers built-in tools.
func RegisterAll(r *registry.Registry) {
	r.MustRegister(Echo{})
	r.MustRegister(GetTime{})
}
