package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	return "Read the contents of a file. Returns the file content as text. " +
		"Large files are paginated: use offset to read the next chunk."
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
			"offset": map[string]any{
				"type":        "integer",
				"description": "Byte offset to start reading from (default 0). Use to paginate large files.",
			},
			"max_bytes": map[string]any{
				"type":        "integer",
				"description": "Maximum bytes to read in this call (default 1048576 = 1MB)",
			},
		},
		"required": []string{"path"},
	}
}

// Execute runs the tool. Large files are read in [offset, offset+maxBytes);
// the response reports total_size and truncated so the caller can page
// through the rest with a higher offset.
func (r ReadFile) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Path     string `json:"path"`
		Encoding string `json:"encoding"`
		Offset   int64  `json:"offset"`
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
	if args.Offset < 0 {
		args.Offset = 0
	}

	info, err := os.Stat(safePath)
	if err != nil {
		return tool.Result{}, fmt.Errorf("stat file: %w", err)
	}
	totalSize := info.Size()

	f, err := os.Open(safePath)
	if err != nil {
		return tool.Result{}, fmt.Errorf("read file: %w", err)
	}
	defer f.Close()

	if args.Offset > 0 {
		if _, err := f.Seek(args.Offset, io.SeekStart); err != nil {
			return tool.Result{}, fmt.Errorf("seek file: %w", err)
		}
	}
	// LimitRead caps at maxBytes so a huge file can't be loaded whole.
	data, err := io.ReadAll(io.LimitReader(f, int64(maxBytes)))
	if err != nil {
		return tool.Result{}, fmt.Errorf("read file: %w", err)
	}

	read := len(data)
	truncated := args.Offset+int64(read) < totalSize

	var content string
	if args.Encoding == "base64" {
		content = encodeBase64(data)
	} else {
		content = string(data)
		if truncated {
			content += "\n...[truncated, call read_file again with offset=" +
				fmt.Sprintf("%d", args.Offset+int64(read)) + "]"
		}
	}

	out, _ := json.Marshal(map[string]any{
		"path":       args.Path,
		"total_size": totalSize,
		"offset":     args.Offset,
		"read":       read,
		"truncated":  truncated,
		"encoding":   args.Encoding,
		"content":    content,
	})
	return tool.Result{Output: out}, nil
}
