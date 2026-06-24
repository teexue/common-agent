package builtin

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/teexue/common-agent/core/tool"
)

const defaultMaxSearchResults = 50

// SearchFiles searches for a regex pattern in files.
type SearchFiles struct {
	WorkDir string // sandbox root for path resolution
}

func (SearchFiles) Name() string { return "search_files" }
func (SearchFiles) Description() string {
	return "Search for a regex pattern in files within a directory. Returns matching lines with file paths and line numbers."
}
func (SearchFiles) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"pattern": map[string]any{
				"type":        "string",
				"description": "Regular expression pattern to search for",
			},
			"path": map[string]any{
				"type":        "string",
				"description": "Directory to search in (relative to work directory or absolute, default='.')",
			},
			"glob": map[string]any{
				"type":        "string",
				"description": "Glob pattern to filter files (e.g., '*.go', '*.ts')",
			},
			"max_results": map[string]any{
				"type":        "integer",
				"description": "Maximum number of results to return (default 50)",
			},
		},
		"required": []string{"pattern"},
	}
}

type searchMatch struct {
	File    string `json:"file"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Text    string `json:"text"`
}

func (sf SearchFiles) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Pattern    string `json:"pattern"`
		Path       string `json:"path"`
		Glob       string `json:"glob"`
		MaxResults int    `json:"max_results"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse search_files input: %w", err)
	}

	if args.Pattern == "" {
		return tool.Result{}, fmt.Errorf("pattern is required")
	}

	re, err := regexp.Compile(args.Pattern)
	if err != nil {
		return tool.Result{}, fmt.Errorf("invalid regex pattern: %w", err)
	}

	searchDir := args.Path
	if searchDir == "" {
		searchDir = "."
	}

	workDir := resolveWorkDir(ctx, sf.WorkDir)
	safePath, err := SafePath(workDir, searchDir)
	if err != nil {
		return tool.Result{}, err
	}

	maxResults := args.MaxResults
	if maxResults <= 0 {
		maxResults = defaultMaxSearchResults
	}

	var matches []searchMatch
	truncated := false

	err = filepath.Walk(safePath, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}

		// Apply glob filter
		if args.Glob != "" {
			matched, _ := filepath.Match(args.Glob, info.Name())
			if !matched {
				return nil
			}
		}

		// Skip binary files (simple heuristic: check first 512 bytes)
		file, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		scanner.Buffer(make([]byte, 0, 64*1024), 64*1024) // 64KB max line

		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := scanner.Text()

			// Quick check if line might contain match
			loc := re.FindStringIndex(line)
			if loc == nil {
				continue
			}

			relPath, _ := filepath.Rel(safePath, path)
			matches = append(matches, searchMatch{
				File:   relPath,
				Line:   lineNum,
				Column: loc[0] + 1,
				Text:   line,
			})

			if len(matches) >= maxResults {
				truncated = true
				return filepath.SkipAll
			}
		}

		if len(matches) >= maxResults {
			truncated = true
			return filepath.SkipAll
		}

		return nil
	})
	if err != nil {
		return tool.Result{}, fmt.Errorf("search files: %w", err)
	}

	out, _ := json.Marshal(map[string]any{
		"pattern":    args.Pattern,
		"path":       searchDir,
		"count":      len(matches),
		"matches":    matches,
		"truncated":  truncated,
	})
	return tool.Result{Output: out}, nil
}
