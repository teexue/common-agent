package config

import (
	"fmt"
	"os"

	"github.com/teexue/common-agent/core/mcp"
	"gopkg.in/yaml.v3"
)

// mcpFile wraps a list of global MCP servers for YAML (de)serialization.
type mcpFile struct {
	Servers []mcp.ServerConfig `yaml:"servers"`
}

// LoadGlobalMCP reads the shared MCP servers from mcp.yaml under home.
// A missing file returns an empty (non-nil) slice and no error.
func LoadGlobalMCP(home string) ([]mcp.ServerConfig, error) {
	data, err := os.ReadFile(MCPFile(home))
	if err != nil {
		if os.IsNotExist(err) {
			return []mcp.ServerConfig{}, nil
		}
		return nil, fmt.Errorf("read global mcp: %w", err)
	}
	var f mcpFile
	if err := yaml.Unmarshal(data, &f); err != nil {
		return nil, fmt.Errorf("parse global mcp: %w", err)
	}
	if f.Servers == nil {
		f.Servers = []mcp.ServerConfig{}
	}
	return f.Servers, nil
}

// SaveGlobalMCP persists the full list of global MCP servers to mcp.yaml.
func SaveGlobalMCP(home string, servers []mcp.ServerConfig) error {
	if err := ensureHome(home); err != nil {
		return err
	}
	data, err := yaml.Marshal(mcpFile{Servers: servers})
	if err != nil {
		return fmt.Errorf("marshal global mcp: %w", err)
	}
	if err := os.WriteFile(MCPFile(home), data, 0o644); err != nil {
		return fmt.Errorf("write global mcp: %w", err)
	}
	return nil
}

// UpsertGlobalMCP adds or replaces a global MCP server by name.
func UpsertGlobalMCP(home string, srv mcp.ServerConfig) error {
	if srv.Name == "" {
		return fmt.Errorf("mcp server name is required")
	}
	servers, err := LoadGlobalMCP(home)
	if err != nil {
		return err
	}
	for i, s := range servers {
		if s.Name == srv.Name {
			servers[i] = srv
			return SaveGlobalMCP(home, servers)
		}
	}
	servers = append(servers, srv)
	return SaveGlobalMCP(home, servers)
}

// DeleteGlobalMCP removes a global MCP server by name.
// Returns os.ErrNotExist if no server matches.
func DeleteGlobalMCP(home, name string) error {
	servers, err := LoadGlobalMCP(home)
	if err != nil {
		return err
	}
	for i, s := range servers {
		if s.Name == name {
			servers = append(servers[:i], servers[i+1:]...)
			return SaveGlobalMCP(home, servers)
		}
	}
	return fmt.Errorf("global mcp server %q: %w", name, os.ErrNotExist)
}
