package provider_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/teexue/common-agent/core/provider"
)

func TestIsToolImageUserMessage(t *testing.T) {
	assert.True(t, provider.IsToolImageUserMessage(provider.Message{
		Role:    provider.RoleUser,
		Content: provider.ToolImageUserContent("read_image"),
	}))
	assert.False(t, provider.IsToolImageUserMessage(provider.Message{
		Role:    provider.RoleUser,
		Content: "hello",
	}))
	assert.False(t, provider.IsToolImageUserMessage(provider.Message{
		Role:    provider.RoleTool,
		Content: provider.ToolImageUserContent("read_image"),
	}))
}
