package main

import (
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/scenario"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

func newRegistry() *registry.Registry {
	reg := registry.New()
	builtin.RegisterAll(reg)
	return reg
}

func resolveProvider(catalog *provider.Catalog, useMock bool) func(sc *scenario.Scenario) (provider.Provider, error) {
	return func(sc *scenario.Scenario) (provider.Provider, error) {
		if useMock {
			return mockProvider(), nil
		}
		return catalog.ResolveForScenario(sc.Provider)
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
