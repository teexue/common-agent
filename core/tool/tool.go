package tool

import (
	"context"
	"encoding/json"
)

// Result is returned by a tool execution.
type Result struct {
	Output json.RawMessage `json:"output"`
}

// Tool is the unified capability abstraction.
type Tool interface {
	Name() string
	Description() string
	InputSchema() map[string]any
	Execute(ctx context.Context, input json.RawMessage) (Result, error)
}
