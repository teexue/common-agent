package mcp

import "context"

// Client is the interface for interacting with an MCP server.
// Implementations include StdioClient (subprocess) and SSEClient (HTTP).
type Client interface {
	// Connect establishes the connection and performs the MCP handshake.
	Connect(ctx context.Context) error

	// ListTools returns the tools provided by the server.
	ListTools(ctx context.Context) ([]ToolDefinition, error)

	// CallTool invokes a tool on the server.
	CallTool(ctx context.Context, name string, args map[string]any) (*CallToolResult, error)

	// Close shuts down the connection gracefully.
	Close() error

	// Name returns the server name (from config or server info).
	Name() string
}
