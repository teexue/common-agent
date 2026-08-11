package builtin

import (
	"context"
	"encoding/json"
	"time"

	"github.com/teexue/common-agent/core/tool"
	"github.com/teexue/common-agent/tools/registry"
)

// GetTime returns the current UTC time.
type GetTime struct{}

// Name returns the tool name.
func (GetTime) Name() string        { return "get_time" }
// Description returns a human-readable description.
func (GetTime) Description() string { return "Return the current UTC time in RFC3339 format." }
// InputSchema returns the JSON Schema for the tool's input.
func (GetTime) InputSchema() map[string]any {
	return map[string]any{
		"type":       "object",
		"properties": map[string]any{},
	}
}

// Execute runs the tool.
func (GetTime) Execute(_ context.Context, _ json.RawMessage) (tool.Result, error) {
	out, _ := json.Marshal(map[string]string{"time": time.Now().UTC().Format(time.RFC3339)})
	return tool.Result{Output: out}, nil
}

// RegisterAll registers all built-in tools.
// workDir is the sandbox root for file operation tools (typically the agent's home directory).
func RegisterAll(r *registry.Registry, workDir string) {
	r.MustRegister(GetTime{})

	// File operation tools
	r.MustRegister(ReadFile{WorkDir: workDir})
	r.MustRegister(WriteFile{WorkDir: workDir})
	r.MustRegister(ListDirectory{WorkDir: workDir})
	r.MustRegister(EditFile{WorkDir: workDir})
	r.MustRegister(CreateDirectory{WorkDir: workDir})
	r.MustRegister(SearchFiles{WorkDir: workDir})

	// Command execution
	r.MustRegister(RunCommand{WorkDir: workDir})

	// Network
	r.MustRegister(WebFetch{})
}
