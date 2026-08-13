package compaction

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/teexue/common-agent/core/provider"
)

func TestExtractFacts_KeyInfo(t *testing.T) {
	msgs := []provider.Message{
		{Role: provider.RoleUser, Content: "请修复 /src/main.go 的编译错误"},
		{Role: provider.RoleAssistant, ToolCalls: []provider.ToolCall{{Name: "read_file", Arguments: []byte(`{"path":"/src/main.go"}`)}}},
		{Role: provider.RoleTool, Name: "read_file", Content: "package main\nfunc main() {}"},
		{Role: provider.RoleUser, Content: "继续"},
	}
	facts := ExtractFacts(msgs, 0)
	assert.Contains(t, facts, "用户:")
	assert.Contains(t, facts, "请修复")
	assert.Contains(t, facts, "工具: read_file")
	assert.Contains(t, facts, "/src/main.go")
}

func TestExtractFacts_Empty(t *testing.T) {
	assert.Equal(t, "", ExtractFacts(nil, 0))
	assert.Equal(t, "", ExtractFacts([]provider.Message{{Role: provider.RoleSystem, Content: "sys"}}, 0))
}

func TestExtractFacts_RespectsMaxChars(t *testing.T) {
	long := strings.Repeat("很长的用户指令内容", 500)
	msgs := []provider.Message{
		{Role: provider.RoleUser, Content: long},
		{Role: provider.RoleUser, Content: "第二条"},
	}
	facts := ExtractFacts(msgs, 200)
	assert.LessOrEqual(t, len(facts), 200)
	assert.Contains(t, facts, "第二条")
}

func TestExtractFacts_DeduplicatesPaths(t *testing.T) {
	msgs := []provider.Message{
		{Role: provider.RoleUser, Content: "看看 /a/b.go 和 /a/b.go"},
		{Role: provider.RoleTool, Name: "read_file", Content: "/a/b.go 内容"},
	}
	facts := ExtractFacts(msgs, 0)
	// The path is listed once in the 文件 facts (it may also appear inside
	// verbatim user/tool text, which is fine).
	assert.Equal(t, 1, strings.Count(facts, "文件: /a/b.go"))
}
