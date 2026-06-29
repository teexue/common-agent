package mcp

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/teexue/common-agent/core/tool"
)

// ServerConfig describes an MCP server connection.
type ServerConfig struct {
	Name    string            `yaml:"name"`
	Type    string            `yaml:"type"` // "stdio" | "sse"
	Command string            `yaml:"command,omitempty"`
	Args    []string          `yaml:"args,omitempty"`
	Env     map[string]string `yaml:"env,omitempty"`
	URL     string            `yaml:"url,omitempty"`
}

// Manager manages MCP server connections and their tools.
type Manager struct {
	servers []ServerConfig
	logger  *slog.Logger

	mu      sync.Mutex
	clients map[string]Client
	tools   map[string]tool.Tool // tool name → tool
}

// NewManager creates a Manager for the given server configs.
func NewManager(servers []ServerConfig, logger *slog.Logger) *Manager {
	if logger == nil {
		logger = slog.Default()
	}
	return &Manager{
		servers: servers,
		logger:  logger,
		clients: make(map[string]Client),
		tools:   make(map[string]tool.Tool),
	}
}

// ConnectAll connects to all configured MCP servers and returns all discovered tools.
// Failed connections are logged but do not stop other servers from connecting.
func (m *Manager) ConnectAll(ctx context.Context) []tool.Tool {
	var allTools []tool.Tool

	for _, cfg := range m.servers {
		client := m.createClient(cfg)
		if err := client.Connect(ctx); err != nil {
			m.logger.Error("mcp server connect failed", "name", cfg.Name, "type", cfg.Type, "error", err)
			continue
		}

		tools, err := client.ListTools(ctx)
		if err != nil {
			m.logger.Error("mcp list tools failed", "name", cfg.Name, "error", err)
			client.Close()
			continue
		}

		m.mu.Lock()
		m.clients[cfg.Name] = client
		for _, def := range tools {
			t := NewExternalTool(def, client)
			m.tools[def.Name] = t
			allTools = append(allTools, t)
		}
		m.mu.Unlock()

		m.logger.Info("mcp server connected", "name", cfg.Name, "tools", len(tools))
	}

	return allTools
}

// GetTool returns a tool by name, if it belongs to an MCP server.
func (m *Manager) GetTool(name string) (tool.Tool, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.tools[name]
	return t, ok
}

// Close shuts down all MCP server connections.
func (m *Manager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for name, client := range m.clients {
		if err := client.Close(); err != nil {
			m.logger.Error("mcp close error", "name", name, "error", err)
		}
	}
	m.clients = make(map[string]Client)
	m.tools = make(map[string]tool.Tool)
}

// Names returns the names of all connected MCP servers.
func (m *Manager) Names() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	names := make([]string, 0, len(m.clients))
	for name := range m.clients {
		names = append(names, name)
	}
	return names
}

// ToolNames returns the names of all MCP tools.
func (m *Manager) ToolNames() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	names := make([]string, 0, len(m.tools))
	for name := range m.tools {
		names = append(names, name)
	}
	return names
}

// MCPServerStatus represents the status of an MCP server.
type MCPServerStatus struct {
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	Connected bool     `json:"connected"`
	Tools     []string `json:"tools"`
}

// Status returns the status of all configured MCP servers.
func (m *Manager) Status() []MCPServerStatus {
	m.mu.Lock()
	defer m.mu.Unlock()

	var result []MCPServerStatus
	for _, cfg := range m.servers {
		client, connected := m.clients[cfg.Name]
		result = append(result, MCPServerStatus{
			Name:      cfg.Name,
			Type:      cfg.Type,
			Connected: connected,
			Tools:     m.clientTools(client, connected),
		})
	}
	return result
}

// clientTools returns tool names belonging to the given client.
func (m *Manager) clientTools(client Client, connected bool) []string {
	if !connected {
		return nil
	}
	var names []string
	for toolName, t := range m.tools {
		if ext, ok := t.(*ExternalTool); ok && ext.client == client {
			names = append(names, toolName)
		}
	}
	return names
}

// Reconnect attempts to reconnect a disconnected server with exponential backoff.
func (m *Manager) Reconnect(ctx context.Context, cfg ServerConfig) {
	const maxDelay = 60 * time.Second
	delay := time.Second

	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}

		client := m.createClient(cfg)
		if err := client.Connect(ctx); err != nil {
			m.logger.Warn("mcp reconnect failed", "name", cfg.Name, "error", err)
			delay *= 2
			if delay > maxDelay {
				delay = maxDelay
			}
			continue
		}

		tools, err := client.ListTools(ctx)
		if err != nil {
			m.logger.Error("mcp list tools failed on reconnect", "name", cfg.Name, "error", err)
			client.Close()
			delay *= 2
			if delay > maxDelay {
				delay = maxDelay
			}
			continue
		}

		m.mu.Lock()
		m.clients[cfg.Name] = client
		for _, def := range tools {
			t := NewExternalTool(def, client)
			m.tools[def.Name] = t
		}
		m.mu.Unlock()

		m.logger.Info("mcp server reconnected", "name", cfg.Name, "tools", len(tools))
		return
	}
}

func (m *Manager) createClient(cfg ServerConfig) Client {
	switch cfg.Type {
	case "stdio":
		return NewStdioClient(StdioConfig{
			Name:    cfg.Name,
			Command: cfg.Command,
			Args:    cfg.Args,
			Env:     cfg.Env,
			Logger:  m.logger,
		})
	case "sse":
		return NewSSEClient(SSEConfig{
			Name:   cfg.Name,
			URL:    cfg.URL,
			Logger: m.logger,
		})
	default:
		m.logger.Error("unknown mcp server type", "type", cfg.Type, "name", cfg.Name)
		return nil
	}
}
