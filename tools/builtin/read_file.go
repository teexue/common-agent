package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/teexue/common-agent/core/tool"
)

const defaultMaxReadBytes = 1024 * 1024 // 1MB

// ReadFile reads the contents of a file.
type ReadFile struct {
	WorkDir string // sandbox root for path resolution
}

// Name returns the tool name.
func (ReadFile) Name() string { return "read_file" }
// Description returns a human-readable description.
func (ReadFile) Description() string {
	return "Read the contents of a file. Returns the file content as text."
}

// InputSchema returns the JSON Schema for the tool's input.
func (ReadFile) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "Path to the file (relative to work directory or absolute)",
			},
			"encoding": map[string]any{
				"type":        "string",
				"description": "File encoding: 'utf-8' (default) or 'base64'",
				"enum":        []string{"utf-8", "base64"},
			},
			"max_bytes": map[string]any{
				"type":        "integer",
				"description": "Maximum bytes to read (default 1048576 = 1MB)",
			},
		},
		"required": []string{"path"},
	}
}

// Execute runs the tool.
func (r ReadFile) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Path     string `json:"path"`
		Encoding string `json:"encoding"`
		MaxBytes int    `json:"max_bytes"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse read_file input: %w", err)
	}

	workDir := resolveWorkDir(ctx, r.WorkDir)
	safePath, err := SafePath(workDir, args.Path)
	if err != nil {
		return tool.Result{}, err
	}

	maxBytes := args.MaxBytes
	if maxBytes <= 0 {
		maxBytes = defaultMaxReadBytes
	}

	data, err := os.ReadFile(safePath)
	if err != nil {
		return tool.Result{}, fmt.Errorf("read file: %w", err)
	}

	if len(data) > maxBytes {
		data = data[:maxBytes]
	}

	var content string
	if args.Encoding == "base64" {
		content = encodeBase64(data)
	} else {
		content = string(data)
	}

	out, _ := json.Marshal(map[string]any{
		"path":     args.Path,
		"size":     len(data),
		"encoding": args.Encoding,
		"content":  content,
	})
	return tool.Result{Output: out}, nil
}
