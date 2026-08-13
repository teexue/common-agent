package builtin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"time"

	"github.com/teexue/common-agent/core/tool"
)

const defaultCommandTimeout = 30 * time.Second

// maxCommandOutputBytes caps the captured stdout/stderr per command. Without a
// cap, a chatty command (logs, build output, tests) can produce megabytes that
// then get re-sent to the LLM on every following turn.
const maxCommandOutputBytes = 1024 * 1024 // 1 MB each

// MaxCommandOutputForTest exposes the cap for tests.
const MaxCommandOutputForTest = maxCommandOutputBytes

// RunCommand executes a shell command.
type RunCommand struct {
	WorkDir string // working directory for command execution
}

// Name returns the tool name.
func (RunCommand) Name() string { return "run_command" }
// Description returns a human-readable description.
func (RunCommand) Description() string {
	return "Execute a shell command and return its output. Use with caution — commands run in the agent's working directory."
}

// InputSchema returns the JSON Schema for the tool's input.
func (RunCommand) InputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"command": map[string]any{
				"type":        "string",
				"description": "The shell command to execute",
			},
			"workdir": map[string]any{
				"type":        "string",
				"description": "Working directory for the command (relative to agent work dir or absolute, optional)",
			},
			"timeout": map[string]any{
				"type":        "integer",
				"description": "Timeout in seconds (default 30)",
			},
		},
		"required": []string{"command"},
	}
}

// Execute runs the tool.
func (rc RunCommand) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args struct {
		Command string `json:"command"`
		WorkDir string `json:"workdir"`
		Timeout int    `json:"timeout"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return tool.Result{}, fmt.Errorf("parse run_command input: %w", err)
	}

	if args.Command == "" {
		return tool.Result{}, fmt.Errorf("command is required")
	}

	timeout := defaultCommandTimeout
	if args.Timeout > 0 {
		timeout = time.Duration(args.Timeout) * time.Second
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sh", "-c", args.Command)

	// Set working directory
	workDir := resolveWorkDir(ctx, rc.WorkDir)
	if args.WorkDir != "" {
		safePath, err := SafePath(workDir, args.WorkDir)
		if err != nil {
			return tool.Result{}, err
		}
		workDir = safePath
	}
	if workDir != "" {
		cmd.Dir = workDir
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	// Cap captured output so chatty commands can't flood session history.
	stdoutOut := capOutput(stdout.String(), maxCommandOutputBytes)
	stderrOut := capOutput(stderr.String(), maxCommandOutputBytes)

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else if ctx.Err() == context.DeadlineExceeded {
			out, _ := json.Marshal(map[string]any{
				"stdout":     stdoutOut,
				"stderr":     "command timed out",
				"exit_code":  -1,
				"timed_out":  true,
			})
			return tool.Result{Output: out}, nil
		} else {
			return tool.Result{}, fmt.Errorf("execute command: %w", err)
		}
	}

	out, _ := json.Marshal(map[string]any{
		"stdout":    stdoutOut,
		"stderr":    stderrOut,
		"exit_code": exitCode,
	})
	return tool.Result{Output: out}, nil
}

// capOutput truncates s to max bytes, appending a marker when truncated.
func capOutput(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "\n...[output truncated]"
}
