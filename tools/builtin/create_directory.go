package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/teexue/common-agent/core/tool"
)

// CreateDirectory creates a directory (and any necessary parents).
type CreateDirectory struct {
	WorkDir string // sandbox root for path resolution
}

func (CreateDirectory) Name() string { return "create_directory" }
func (CreateDirectory) Description() string {
	return "Create a directory and any necessary parent directories. Returns the created path."
}
func (CreateDirectory) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "Path of the directory to create (relative to work directory or absolute)",
			},
		},
		"required": []string{"path"},
	}
}

func (cd CreateDirectory) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse create_directory input: %w", err)
	}

	workDir := resolveWorkDir(ctx, cd.WorkDir)
	safePath, err := SafePath(workDir, args.Path)
	if err != nil {
		return tool.Result{}, err
	}

	if err := os.MkdirAll(safePath, 0o755); err != nil {
		return tool.Result{}, fmt.Errorf("create directory: %w", err)
	}

	out, _ := json.Marshal(map[string]any{
		"path": args.Path,
	})
	return tool.Result{Output: out}, nil
}
