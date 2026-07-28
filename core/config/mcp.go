package config

import (
	"fmt"
	"os"

	"github.com/teexue/common-agent/core/mcp"
	"gopkg.in/yaml.v3"
)

type mcpFile struct {
	Servers []mcp.ServerConfig `yaml:"servers"`
}

// LoadGlobalMCP reads global MCP servers from SQLite when bound, else mcp.yaml.
func LoadGlobalMCP(home string) ([]mcp.ServerConfig, error) {
	if stateDB != nil {
		return stateDB.LoadGlobalMCP()
	}
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

// SaveGlobalMCP persists the full list of global MCP servers.
func SaveGlobalMCP(home string, servers []mcp.ServerConfig) error {
	if stateDB != nil {
		existing, err := stateDB.LoadGlobalMCP()
		if err != nil {
			return err
		}
		for _, s := range existing {
			_ = stateDB.DeleteGlobalMCP(s.Name)
		}
		for _, s := range servers {
			if err := stateDB.UpsertGlobalMCP(s); err != nil {
				return err
			}
		}
		return nil
	}
	if err := ensureHome(home); err != nil {
		return err
	}
	data, err := yaml.Marshal(mcpFile{Servers: servers})
	if err != nil {
		return fmt.Errorf("marshal global mcp: %w", err)
	}
	return os.WriteFile(MCPFile(home), data, 0o644)
}

// UpsertGlobalMCP adds or replaces a global MCP server by name.
func UpsertGlobalMCP(home string, srv mcp.ServerConfig) error {
	if stateDB != nil {
		return stateDB.UpsertGlobalMCP(srv)
	}
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
func DeleteGlobalMCP(home, name string) error {
	if stateDB != nil {
		return stateDB.DeleteGlobalMCP(name)
	}
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
