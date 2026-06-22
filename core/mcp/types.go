package mcp

import "encoding/json"

// JSON-RPC 2.0 message types for MCP protocol.

const jsonrpcVersion = "2.0"

// Request is a JSON-RPC 2.0 request.
type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// Response is a JSON-RPC 2.0 response.
type Response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

// RPCError is a JSON-RPC 2.0 error object.
type RPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (e *RPCError) Error() string {
	return e.Message
}

// Notification is a JSON-RPC 2.0 notification (no ID, no response expected).
type Notification struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// --- MCP Protocol Types ---

// InitializeParams is sent by the client to start the session.
type InitializeParams struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ClientCapabilities `json:"capabilities"`
	ClientInfo      ClientInfo         `json:"clientInfo"`
}

// ClientCapabilities describes what the client supports.
type ClientCapabilities struct {
	Tools *ToolsCapability `json:"tools,omitempty"`
}

// ToolsCapability indicates tool support.
type ToolsCapability struct{}

// ClientInfo identifies the client implementation.
type ClientInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// InitializeResult is returned by the server after initialization.
type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      ServerInfo         `json:"serverInfo"`
}

// ServerCapabilities describes what the server supports.
type ServerCapabilities struct {
	Tools *ToolsCapability `json:"tools,omitempty"`
}

// ServerInfo identifies the server implementation.
type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// ToolDefinition describes a tool provided by an MCP server.
type ToolDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	InputSchema map[string]any `json:"inputSchema"`
}

// ListToolsResult is the result of tools/list.
type ListToolsResult struct {
	Tools []ToolDefinition `json:"tools"`
}

// CallToolParams is the params for tools/call.
type CallToolParams struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments,omitempty"`
}

// CallToolResult is the result of tools/call.
type CallToolResult struct {
	Content []Content `json:"content"`
	IsError bool      `json:"isError,omitempty"`
}

// Content is a single content item in a tool result.
type Content struct {
	Type string `json:"type"` // "text", "image", etc.
	Text string `json:"text,omitempty"`
}

// MarshalText returns the text content, concatenating all text items.
func (r *CallToolResult) MarshalText() string {
	var out string
	for _, c := range r.Content {
		if c.Type == "text" {
			out += c.Text
		}
	}
	return out
}
