package main

import (
	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func newRegistry() *registry.Registry {
	reg := registry.New()
	builtin.RegisterAll(reg)
	return reg
}

func resolveProvider(catalog *provider.Catalog, useMock bool) func(a *agent.Agent) (provider.Provider, error) {
	return func(a *agent.Agent) (provider.Provider, error) {
		if useMock {
			return mockProvider(), nil
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
