package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/teexue/common-agent/core/tool"
)

const maxDirEntries = 200

// ListDirectory lists the contents of a directory.
type ListDirectory struct {
	WorkDir string // sandbox root for path resolution
}

func (ListDirectory) Name() string { return "list_directory" }
func (ListDirectory) Description() string {
	return "List the immediate contents of a directory (non-recursive). Returns an array of entries with name, size, type, and modification time."
}
func (ListDirectory) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "Path to the directory (relative to work directory or absolute, default='.')",
			},
			"pattern": map[string]any{
				"type":        "string",
				"description": "Glob pattern to filter entries (e.g., '*.go')",
			},
			"limit": map[string]any{
				"type":        "integer",
				"description": fmt.Sprintf("Max entries to return (default %d)", maxDirEntries),
			},
		},
	}
}

type dirEntry struct {
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	IsDir   bool   `json:"is_dir"`
	ModTime string `json:"mod_time"`
}

func (ld ListDirectory) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Path    string `json:"path"`
		Pattern string `json:"pattern"`
		Limit   int    `json:"limit"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse list_directory input: %w", err)
	}

	targetDir := args.Path
	if targetDir == "" {
		targetDir = "."
	}

	workDir := resolveWorkDir(ctx, ld.WorkDir)
	safePath, err := SafePath(workDir, targetDir)
	if err != nil {
		return tool.Result{}, err
	}

	info, err := os.Stat(safePath)
	if err != nil {
		return tool.Result{}, fmt.Errorf("stat path: %w", err)
	}
	if !info.IsDir() {
		return tool.Result{}, fmt.Errorf("path %q is not a directory", targetDir)
	}

	dirEntries, err := os.ReadDir(safePath)
	if err != nil {
		return tool.Result{}, fmt.Errorf("read directory: %w", err)
	}

	var entries []dirEntry
	for _, de := range dirEntries {
		if args.Pattern != "" {
			matched, _ := filepath.Match(args.Pattern, de.Name())
			if !matched {
				continue
			}
		}
		fi, fiErr := de.Info()
		if fiErr != nil {
			continue
		}
		entries = append(entries, dirEntry{
			Name:    de.Name(),
			Size:    fi.Size(),
			IsDir:   de.IsDir(),
			ModTime: fi.ModTime().Format("2006-01-02T15:04:05Z"),
		})
	}

	total := len(entries)
	limit := args.Limit
	if limit <= 0 || limit > maxDirEntries {
		limit = maxDirEntries
	}
	if total > limit {
		entries = entries[:limit]
	}

	out, _ := json.Marshal(map[string]any{
		"path":      targetDir,
		"count":     total,
		"showing":   len(entries),
		"truncated": total > limit,
		"entries":   entries,
	})
	return tool.Result{Output: out}, nil
}
