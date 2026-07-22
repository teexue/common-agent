package main

import (
	"fmt"
	"os"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func newRegistry(workDir string) *registry.Registry {
	// If no workDir specified, use current working directory.
	if workDir == "" {
		if cwd, err := os.Getwd(); err == nil {
			workDir = cwd
		}
	}
	reg := registry.New()
	builtin.RegisterAll(reg, workDir)
	return reg
}

func resolveProvider(catalog *provider.Catalog, useMock bool) func(a *agent.Agent) (provider.Provider, error) {
	return func(a *agent.Agent) (provider.Provider, error) {
		if useMock {
			return mockProvider(), nil
		}
		if catalog == nil {
			return nil, fmt.Errorf("no provider configured; add one in the Settings UI or run: agent-server config set provider")
		}
		return catalog.ResolveForAgent(a.Provider)
	}
}

func mockProvider() provider.Provider {
	return &provider.MockProvider{
		Calls: [][]provider.MockStep{
			{{
				ToolCalls: []provider.ToolCall{{
					ID: "call_1", Name: "get_time", Arguments: []byte("{}"),
				}},
			}},
			{{Text: "The current time has been retrieved."}},
		},
	}
}
