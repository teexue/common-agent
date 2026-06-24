package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/teexue/common-agent/core/tool"
)

// EditFile performs precise text replacement in a file.
type EditFile struct {
	WorkDir string // sandbox root for path resolution
}

func (EditFile) Name() string { return "edit_file" }
func (EditFile) Description() string {
	return "Replace text in a file using exact string matching. Safer than write_file for targeted changes. Returns the number of replacements made."
}
func (EditFile) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "Path to the file (relative to work directory or absolute)",
			},
			"old_string": map[string]any{
				"type":        "string",
				"description": "The exact string to find and replace",
			},
			"new_string": map[string]any{
				"type":        "string",
				"description": "The replacement string",
			},
			"all": map[string]any{
				"type":        "boolean",
				"description": "Replace all occurrences (default false, replaces only the first match)",
			},
		},
		"required": []string{"path", "old_string", "new_string"},
	}
}

func (ef EditFile) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Path      string `json:"path"`
		OldString string `json:"old_string"`
		NewString string `json:"new_string"`
		All       bool   `json:"all"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse edit_file input: %w", err)
	}

	if args.OldString == "" {
		return tool.Result{}, fmt.Errorf("old_string is required")
	}

	workDir := resolveWorkDir(ctx, ef.WorkDir)
	safePath, err := SafePath(workDir, args.Path)
	if err != nil {
		return tool.Result{}, err
	}

	data, err := os.ReadFile(safePath)
	if err != nil {
		return tool.Result{}, fmt.Errorf("read file: %w", err)
	}

	content := string(data)

	if !strings.Contains(content, args.OldString) {
		return tool.Result{}, fmt.Errorf("old_string not found in file")
	}

	var count int
	var newContent string
	if args.All {
		count = strings.Count(content, args.OldString)
		newContent = strings.ReplaceAll(content, args.OldString, args.NewString)
	} else {
		count = 1
		newContent = strings.Replace(content, args.OldString, args.NewString, 1)
	}

	if err := os.WriteFile(safePath, []byte(newContent), 0o644); err != nil {
		return tool.Result{}, fmt.Errorf("write file: %w", err)
	}

	out, _ := json.Marshal(map[string]any{
		"path":         args.Path,
		"replacements": count,
	})
	return tool.Result{Output: out}, nil
}
