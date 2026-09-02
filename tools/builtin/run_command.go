package builtin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"time"
	"unicode/utf8"

	"github.com/teexue/common-agent/core/loop"
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
	return "Execute a shell command and return its output. Use with caution — commands run in the agent's working directory. On Windows the shell is the configured terminal (Git Bash by default when installed)."
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

type runCommandArgs struct {
	Command string `json:"command"`
	WorkDir string `json:"workdir"`
	Timeout int    `json:"timeout"`
}

// Execute runs the tool.
func (rc RunCommand) Execute(ctx context.Context, input json.RawMessage) (tool.Result, error) {
	var args runCommandArgs
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

	sh, err := ResolveShell(loop.GetShell(ctx))
	if err != nil {
		return tool.Result{}, err
	}
	cmd, err := rc.buildCmd(ctx, sh, args)
	if err != nil {
		return tool.Result{}, err
	}
	return captureCommand(ctx, cmd, sh.ID)
}

func (rc RunCommand) buildCmd(ctx context.Context, sh Shell, args runCommandArgs) (*exec.Cmd, error) {
	bin, argv := sh.argv(args.Command)
	cmd := exec.CommandContext(ctx, bin, argv...)
	workDir := resolveWorkDir(ctx, rc.WorkDir)
	if args.WorkDir != "" {
		safePath, err := SafePath(workDir, args.WorkDir)
		if err != nil {
			return nil, err
		}
		workDir = safePath
	}
	if workDir != "" {
		cmd.Dir = workDir
	}
	applyWindowsConsole(cmd, sh)
	return cmd, nil
}

func captureCommand(ctx context.Context, cmd *exec.Cmd, shellID string) (tool.Result, error) {
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	stdoutOut := capOutput(decodeConsole(stdout.Bytes()), maxCommandOutputBytes)
	stderrOut := capOutput(decodeConsole(stderr.Bytes()), maxCommandOutputBytes)
	exitCode := 0
	if err != nil {
		if timedOut, out := timeoutResult(ctx, err, stdoutOut, shellID); timedOut {
			return tool.Result{Output: out}, nil
		}
		exitErr, ok := err.(*exec.ExitError)
		if !ok {
			return tool.Result{}, fmt.Errorf("execute command: %w", err)
		}
		exitCode = exitErr.ExitCode()
	}
	out, _ := json.Marshal(map[string]any{
		"stdout": stdoutOut, "stderr": stderrOut, "exit_code": exitCode, "shell": shellID,
	})
	return tool.Result{Output: out}, nil
}

func timeoutResult(ctx context.Context, err error, stdout, shellID string) (bool, json.RawMessage) {
	if ctx.Err() != context.DeadlineExceeded {
		return false, nil
	}
	if _, ok := err.(*exec.ExitError); ok {
		return false, nil
	}
	out, _ := json.Marshal(map[string]any{
		"stdout": stdout, "stderr": "command timed out",
		"exit_code": -1, "timed_out": true, "shell": shellID,
	})
	return true, out
}

// capOutput truncates s to max bytes, appending a marker when truncated.
func capOutput(s string, max int) string {
	if len(s) <= max {
		return s
	}
	for max > 0 && !utf8.RuneStart(s[max]) {
		max--
	}
	return s[:max] + "\n...[output truncated]"
}
