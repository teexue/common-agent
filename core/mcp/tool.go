package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/teexue/common-agent/core/tool"
)

// ExternalTool wraps an MCP tool as a tool.Tool implementation.
type ExternalTool struct {
	def    ToolDefinition
	client Client
}

// NewExternalTool creates a tool.Tool from an MCP tool definition.
func NewExternalTool(def ToolDefinition, client Client) *ExternalTool {
	return &ExternalTool{def: def, client: client}
}

func (t *ExternalTool) Name() string        { return t.def.Name }
func (t *ExternalTool) Description() string  { return t.def.Description }
func (t *ExternalTool) InputSchema() map[string]any { return t.def.InputSchema }

// Execute calls the MCP tool and returns the result.
func (t *ExternalTool) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args map[string]any
	if len(input) > 0 {
		if err := json.Unmarshal(input, &args); err != nil {
			return tool.Result{}, fmt.Errorf("unmarshal input: %w", err)
		}
	}

	result, err := t.client.CallTool(ctx, t.def.Name, args)
	if err != nil {
		return tool.Result{}, err
	}

	// Convert MCP CallToolResult to tool.Result.
	output, _ := json.Marshal(result.MarshalText())
	return tool.Result{Output: output}, nil
}

// ExternalTools creates tool.Tool instances for all tools from an MCP client.
func ExternalTools(tools []ToolDefinition, client Client) []tool.Tool {
	result := make([]tool.Tool, len(tools))
	for i, def := range tools {
		result[i] = NewExternalTool(def, client)
	}
	return result
}
