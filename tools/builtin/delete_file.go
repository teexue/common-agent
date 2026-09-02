package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/teexue/common-agent/core/tool"
)

// DeleteFile deletes a file, or a directory when recursive is set.
type DeleteFile struct {
	WorkDir string // sandbox root for path resolution
}

// Name returns the tool name.
func (DeleteFile) Name() string { return "delete_file" }

// Description returns a human-readable description.
func (DeleteFile) Description() string {
	return "Delete a file. Set recursive=true to delete a directory and its contents. Paths must stay within the work directory."
}

// InputSchema returns the JSON Schema for the tool's input.
func (DeleteFile) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "Path to delete (relative to work directory or absolute)",
			},
			"recursive": map[string]any{
				"type":        "boolean",
				"description": "If true, delete a directory and all contents. Required for directories.",
			},
		},
		"required": []string{"path"},
	}
}

// Execute runs the tool.
func (d DeleteFile) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Path      string `json:"path"`
		Recursive bool   `json:"recursive"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse delete_file input: %w", err)
	}

	workDir := resolveWorkDir(ctx, d.WorkDir)
	safePath, err := SafePath(workDir, args.Path)
	if err != nil {
		return tool.Result{}, err
	}
	if filepath.Clean(safePath) == filepath.Clean(workDir) {
		return tool.Result{}, fmt.Errorf("cannot delete the work directory root")
	}

	unlock := lockPath(safePath)
	defer unlock()

	if err := removePath(safePath, args.Recursive); err != nil {
		return tool.Result{}, err
	}
	out, _ := json.Marshal(map[string]any{
		"path":    args.Path,
		"deleted": true,
	})
	return tool.Result{Output: out}, nil
}

func removePath(path string, recursive bool) error {
	info, err := os.Lstat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("path %q does not exist", path)
		}
		return fmt.Errorf("stat file: %w", err)
	}
	if info.IsDir() && !recursive {
		return fmt.Errorf("path %q is a directory; set recursive=true to delete", path)
	}
	if info.IsDir() {
		if err := os.RemoveAll(path); err != nil {
			return fmt.Errorf("delete directory: %w", err)
		}
		return nil
	}
	if err := os.Remove(path); err != nil {
		return fmt.Errorf("delete file: %w", err)
	}
	return nil
}
