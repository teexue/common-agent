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
	return "Read the contents of a file. Returns the file content as text. " +
		"offset is always a 1-based line number from the first line of the file. " +
		"If truncated is true, call again with offset=next_offset (also from line 1)."
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
				"description": "1-based line number from the start of the file (default 1).",
			},
			"max_bytes": map[string]any{
				"type":        "integer",
				"description": "Maximum bytes to read in this call (default 1048576 = 1MB)",
			},
		},
		"required": []string{"path"},
	}
}

// Execute runs the tool. offset is a 1-based line number from the first line.
func (r ReadFile) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	args, err := parseReadFileArgs(input)
	if err != nil {
		return tool.Result{}, fmt.Errorf("parse read_file input: %w", err)
	}

	workDir := resolveWorkDir(ctx, r.WorkDir)
	safePath, err := SafePath(workDir, args.Path)
	if err != nil {
		return tool.Result{}, err
	}

	info, err := os.Stat(safePath)
	if err != nil {
		return tool.Result{}, fmt.Errorf("stat file: %w", err)
	}

	f, err := os.Open(safePath)
	if err != nil {
		return tool.Result{}, fmt.Errorf("read file: %w", err)
	}
	defer f.Close()

	startLine := args.Offset
	if startLine < 1 {
		startLine = 1
	}
	data, nextLine, truncated, err := readFileRange(f, startLine, args.MaxBytes)
	if err != nil {
		return tool.Result{}, fmt.Errorf("read file: %w", err)
	}
	return encodeReadOutput(args, data, readMeta{
		startLine: startLine, nextLine: nextLine,
		truncated: truncated, totalSize: info.Size(),
	})
}

type readMeta struct {
	startLine, nextLine, totalSize int64
	truncated                      bool
}

func encodeReadOutput(args readFileArgs, data []byte, meta readMeta) (tool.Result, error) {
	content := string(data)
	if args.Encoding == "base64" {
		content = encodeBase64(data)
	}
	body := map[string]any{
		"path":       args.Path,
		"total_size": meta.totalSize,
		"offset":     meta.startLine,
		"read":       len(data),
		"truncated":  meta.truncated,
		"encoding":   args.Encoding,
		"content":    content,
	}
	if meta.truncated {
		body["next_offset"] = meta.nextLine
	}
	out, _ := json.Marshal(body)
	return tool.Result{Output: out}, nil
}
