package builtin

import (
	"context"
	"encoding/base64"
	"fmt"
	"path/filepath"
	"strings"
)

// workDirCtxKey is the context key for the working directory.
// Set by the loop to override the static WorkDir on tools.
const workDirCtxKey = "workdir"

// resolveWorkDir returns the working directory from context if set,
// otherwise falls back to the static value.
func resolveWorkDir(ctx context.Context, static string) string {
	if v, ok := ctx.Value(workDirCtxKey).(string); ok && v != "" {
		return v
	}
	return static
}

// encodeBase64 encodes bytes as a base64 string.
func encodeBase64(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// decodeBase64 decodes a base64 string to bytes.
func decodeBase64(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

// SafePath resolves and validates that the given path is within the allowed root.
// It prevents directory traversal attacks (e.g., ../../../etc/passwd).
// Returns the cleaned absolute path on success.
//
// Defense in depth: uses both filepath.Clean + prefix check and filepath.Rel
// to ensure the resolved path cannot escape the sandbox root.
func SafePath(root, userPath string) (string, error) {
	if userPath == "" {
		return "", fmt.Errorf("path is required")
	}

	// Resolve relative paths against root
	abs := userPath
	if !filepath.IsAbs(userPath) {
		abs = filepath.Join(root, userPath)
	}

	// Clean the path (resolves .., ., etc.)
	cleaned := filepath.Clean(abs)

	// Ensure the cleaned path is within root
	cleanedRoot := filepath.Clean(root)
	if cleanedRoot == "" {
		cleanedRoot = "."
	}

	// Primary check: prefix-based containment.
	if !strings.HasPrefix(cleaned, cleanedRoot+string(filepath.Separator)) && cleaned != cleanedRoot {
		return "", fmt.Errorf("path %q is outside the allowed directory", userPath)
	}

	// Secondary check (defense in depth): filepath.Rel must not start with "..".
	rel, err := filepath.Rel(cleanedRoot, cleaned)
	if err != nil {
		return "", fmt.Errorf("path %q is outside the allowed directory: %w", userPath, err)
	}
	if strings.HasPrefix(rel, "..") {
		return "", fmt.Errorf("path %q is outside the allowed directory", userPath)
	}

	return cleaned, nil
}
