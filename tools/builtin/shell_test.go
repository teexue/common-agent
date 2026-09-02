package builtin

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDetectShellsUnix(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "linux"
	lookPath = func(name string) (string, error) {
		if name == "sh" {
			return "/bin/sh", nil
		}
		return "", errNotFound{name}
	}
	got := DetectShells()
	require.Len(t, got, 1)
	assert.Equal(t, "sh", got[0].ID)
	assert.Equal(t, "/bin/sh", got[0].Path)
	assert.False(t, ShellSelectable())
}

func TestDetectShellsLinuxPrefersBash(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "linux"
	lookPath = unixLookPathAll
	got := DetectShells()
	require.Len(t, got, 3)
	assert.Equal(t, []string{"bash", "zsh", "sh"}, idsOf(got))
	auto, err := ResolveShell("auto")
	require.NoError(t, err)
	assert.Equal(t, "bash", auto.ID)
}

func TestDetectShellsMacPrefersZsh(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "darwin"
	lookPath = unixLookPathAll
	got := DetectShells()
	require.Len(t, got, 3)
	assert.Equal(t, []string{"zsh", "bash", "sh"}, idsOf(got))
	auto, err := ResolveShell("")
	require.NoError(t, err)
	assert.Equal(t, "zsh", auto.ID)
}

func TestDetectShellsLinuxFallsBackToSh(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "linux"
	lookPath = func(name string) (string, error) {
		switch name {
		case "zsh":
			return "/usr/bin/zsh", nil
		case "sh":
			return "/bin/sh", nil
		default:
			return "", errNotFound{name}
		}
	}
	auto, err := ResolveShell("auto")
	require.NoError(t, err)
	assert.Equal(t, "sh", auto.ID)
}

func TestDetectShellsMacFallsBackToSh(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "darwin"
	lookPath = func(name string) (string, error) {
		switch name {
		case "bash":
			return "/bin/bash", nil
		case "sh":
			return "/bin/sh", nil
		default:
			return "", errNotFound{name}
		}
	}
	auto, err := ResolveShell("auto")
	require.NoError(t, err)
	assert.Equal(t, "sh", auto.ID)
}

func TestResolveShellWindowsPrefersBash(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "windows"
	lookPath = func(name string) (string, error) {
		switch name {
		case "bash":
			return `C:\Program Files\Git\bin\bash.exe`, nil
		case "powershell":
			return `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, nil
		case "cmd":
			return `C:\Windows\System32\cmd.exe`, nil
		default:
			return "", errNotFound{name}
		}
	}
	pathExists = func(string) bool { return false }

	got := DetectShells()
	require.GreaterOrEqual(t, len(got), 3)
	assert.Equal(t, "bash", got[0].ID)
	assert.True(t, ShellSelectable())

	auto, err := ResolveShell("")
	require.NoError(t, err)
	assert.Equal(t, "bash", auto.ID)

	cmd, err := ResolveShell("cmd")
	require.NoError(t, err)
	assert.Equal(t, "cmd", cmd.ID)

	_, err = ResolveShell("pwsh")
	require.Error(t, err)
}

func TestResolveShellWindowsWithoutBash(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "windows"
	lookPath = func(name string) (string, error) {
		switch name {
		case "powershell":
			return `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, nil
		case "cmd":
			return `C:\Windows\System32\cmd.exe`, nil
		default:
			return "", errNotFound{name}
		}
	}
	pathExists = func(string) bool { return false }

	auto, err := ResolveShell("auto")
	require.NoError(t, err)
	assert.Equal(t, "powershell", auto.ID)
}

func TestGitBashCandidatesFromEnv(t *testing.T) {
	t.Setenv("ProgramFiles", `C:\Program Files`)
	t.Setenv("ProgramFiles(x86)", `C:\Program Files (x86)`)
	t.Setenv("LOCALAPPDATA", `C:\Users\me\AppData\Local`)
	got := gitBashCandidates()
	assert.Contains(t, got, filepath.Join(`C:\Program Files`, "Git", "bin", "bash.exe"))
	assert.Contains(t, got, filepath.Join(`C:\Program Files (x86)`, "Git", "bin", "bash.exe"))
	assert.Contains(t, got, filepath.Join(`C:\Users\me\AppData\Local`, "Programs", "Git", "bin", "bash.exe"))
}

func restoreShellProbe() {
	runtimeGOOS = runtimeGOOSRestore
	lookPath = lookPathRestore
	pathExists = pathExistsRestore
}

func unixLookPathAll(name string) (string, error) {
	switch name {
	case "bash":
		return "/bin/bash", nil
	case "zsh":
		return "/bin/zsh", nil
	case "sh":
		return "/bin/sh", nil
	default:
		return "", errNotFound{name}
	}
}

func idsOf(shells []Shell) []string {
	ids := make([]string, len(shells))
	for i, s := range shells {
		ids[i] = s.ID
	}
	return ids
}

var (
	runtimeGOOSRestore = runtimeGOOS
	lookPathRestore    = lookPath
	pathExistsRestore  = pathExists
)

type errNotFound struct{ name string }

func (e errNotFound) Error() string { return e.name + " not found" }
