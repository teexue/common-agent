package config

import (
	"fmt"
	"os"
	"path/filepath"
)

const dirName = ".common-agent"

// Home returns ~/.common-agent, creating it when ensure is true.
func Home(ensure bool) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("user home dir: %w", err)
	}
	dir := filepath.Join(home, dirName)
	if ensure {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return "", fmt.Errorf("create config dir: %w", err)
		}
		if err := os.MkdirAll(AgentsDir(dir), 0o755); err != nil {
			return "", fmt.Errorf("create agents dir: %w", err)
		}
		if err := os.MkdirAll(SessionsDir(dir), 0o755); err != nil {
			return "", fmt.Errorf("create sessions dir: %w", err)
		}
		if err := os.MkdirAll(JobsDir(dir), 0o755); err != nil {
			return "", fmt.Errorf("create jobs dir: %w", err)
		}
	}
	return dir, nil
}

// ProvidersFile returns the providers.yaml path under home.
func ProvidersFile(home string) string {
	return filepath.Join(home, "providers.yaml")
}

// SettingsFile returns the config.yaml path under home.
func SettingsFile(home string) string {
	return filepath.Join(home, "config.yaml")
}

// CredentialsFile returns the credentials.yaml path under home.
func CredentialsFile(home string) string {
	return filepath.Join(home, "credentials.yaml")
}

// AgentsDir returns the agents directory under home.
func AgentsDir(home string) string {
	return filepath.Join(home, "agents")
}

// SessionsDir returns the sessions directory under home.
func SessionsDir(home string) string {
	return filepath.Join(home, "sessions")
}

// JobsDir returns the jobs directory under home.
func JobsDir(home string) string {
	return filepath.Join(home, "jobs")
}

// MCPFile returns the mcp.yaml path under home, holding global shared MCP servers.
func MCPFile(home string) string {
	return filepath.Join(home, "mcp.yaml")
}

// EnsureDirs creates the ~/.common-agent directory structure (home, agents,
// sessions, jobs) without writing any default content. Use this on startup so
// the runtime has a place to read/write without pre-installing vendors or
// agents — initial content is provided by `config init` or the Settings UI.
func EnsureDirs(home string) error {
	for _, d := range []string{home, AgentsDir(home), SessionsDir(home), JobsDir(home)} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return fmt.Errorf("create dir %s: %w", d, err)
		}
	}
	return nil
}
