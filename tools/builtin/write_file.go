package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/teexue/common-agent/core/tool"
)

// WriteFile writes content to a file.
type WriteFile struct {
	WorkDir string // sandbox root for path resolution
}

func (WriteFile) Name() string { return "write_file" }
func (WriteFile) Description() string {
	return "Write content to a file. Creates parent directories if needed. Returns the path and bytes written."
}
func (WriteFile) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "Path to the file (relative to work directory or absolute)",
			},
			"content": map[string]any{
				"type":        "string",
				"description": "Content to write to the file",
			},
			"encoding": map[string]any{
				"type":        "string",
				"description": "Content encoding: 'utf-8' (default) or 'base64'",
				"enum":        []string{"utf-8", "base64"},
			},
		},
		"required": []string{"path", "content"},
	}
}

func (w WriteFile) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Path     string `json:"path"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse write_file input: %w", err)
	}

	workDir := resolveWorkDir(ctx, w.WorkDir)
	safePath, err := SafePath(workDir, args.Path)
	if err != nil {
		return tool.Result{}, err
	}

	// Create parent directories
	if err := os.MkdirAll(filepath.Dir(safePath), 0o755); err != nil {
		return tool.Result{}, fmt.Errorf("create directories: %w", err)
	}

	var data []byte
	if args.Encoding == "base64" {
		data, err = decodeBase64(args.Content)
		if err != nil {
			return tool.Result{}, fmt.Errorf("decode base64: %w", err)
		}
	} else {
		data = []byte(args.Content)
	}

	if err := os.WriteFile(safePath, data, 0o644); err != nil {
		return tool.Result{}, fmt.Errorf("write file: %w", err)
	}

	out, _ := json.Marshal(map[string]any{
		"path":  args.Path,
		"bytes": len(data),
	})
	return tool.Result{Output: out}, nil
}
