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

// Name returns the tool name.
func (SearchFiles) Name() string { return "search_files" }
// Description returns a human-readable description.
func (SearchFiles) Description() string {
	return "Search for a regex pattern in files within a directory. Returns matching lines with file paths and line numbers."
}

// InputSchema returns the JSON Schema for the tool's input.
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

// Execute runs the tool.
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

	matches, truncated := walkAndSearch(safePath, args.Glob, re, maxResults)

	out, _ := json.Marshal(map[string]any{
		"pattern": args.Pattern, "path": searchDir,
		"count": len(matches), "matches": matches, "truncated": truncated,
	})
	return tool.Result{Output: out}, nil
}

// walkAndSearch walks the directory tree and collects regex matches in files.
func walkAndSearch(root, glob string, re *regexp.Regexp, maxResults int) ([]searchMatch, bool) {
	var matches []searchMatch
	truncated := false

	filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil || info.IsDir() {
			return nil
		}
		if glob != "" {
			if matched, _ := filepath.Match(glob, info.Name()); !matched {
				return nil
			}
		}

		fileMatches := scanFileForMatches(path, root, re)
		matches = append(matches, fileMatches...)

		if len(matches) >= maxResults {
			truncated = true
			return filepath.SkipAll
		}
		return nil
	})

	if len(matches) > maxResults {
		matches = matches[:maxResults]
	}
	return matches, truncated
}

// scanFileForMatches scans a single file for regex matches, returning search results.
func scanFileForMatches(path, root string, re *regexp.Regexp) []searchMatch {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()

	var results []searchMatch
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64*1024), 64*1024)

	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		loc := re.FindStringIndex(line)
		if loc == nil {
			continue
		}
		relPath, _ := filepath.Rel(root, path)
		results = append(results, searchMatch{
			File: relPath, Line: lineNum, Column: loc[0] + 1, Text: line,
		})
	}
	return results
}
