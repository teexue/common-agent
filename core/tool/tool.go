package tool

import (
	"context"
	"encoding/json"

	"github.com/teexue/common-agent/core/provider"
)

// Result is returned by a tool execution.
type Result struct {
	Output json.RawMessage `json:"output"`
	// ContentParts are multimodal blocks (typically images) that must be sent
	// to the model as separate content parts — not inlined as JSON text.
	ContentParts []provider.ContentPart `json:"content_parts,omitempty"`
}

// Tool is the unified capability abstraction.
type Tool interface {
	Name() string
	Description() string
	InputSchema() map[string]any
	Execute(ctx context.Context, input json.RawMessage) (Result, error)
}
