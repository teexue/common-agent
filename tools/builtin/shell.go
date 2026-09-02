package builtin

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// Probe hooks so tests can fake Windows without the host OS.
var (
	runtimeGOOS = runtime.GOOS
	lookPath    = exec.LookPath
	pathExists  = func(p string) bool {
		_, err := os.Stat(p)
		return err == nil
	}
)

// Shell is a detected command interpreter used by run_command.
type Shell struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
	args []string
}

// HostOS returns the OS used for shell detection (overridable in tests).
func HostOS() string { return runtimeGOOS }

// ShellSelectable reports whether the host offers a choice of terminals.
func ShellSelectable() bool { return len(DetectShells()) > 1 }

// DetectShells lists shells available on this host, highest preference first.
// Windows: Git Bash, PowerShell 7, Windows PowerShell, CMD.
// macOS: zsh, bash, sh. Other Unix: bash, zsh, sh.
func DetectShells() []Shell {
	if runtimeGOOS == "windows" {
		return detectWindowsShells()
	}
	return unixShells()
}

// ResolveShell picks a shell by id. Empty or "auto" uses the OS default:
// bash on Linux/Unix, zsh on macOS, Git Bash on Windows; otherwise sh.
func ResolveShell(id string) (Shell, error) {
	available := DetectShells()
	if len(available) == 0 {
		return Shell{}, fmt.Errorf("no shell available")
	}
	if id == "" || id == "auto" {
		return pickAutoShell(available), nil
	}
	if s, ok := shellByID(available, id); ok {
		return s, nil
	}
	return Shell{}, fmt.Errorf("shell %q is not available", id)
}

func unixShells() []Shell {
	prefer, other := "bash", "zsh"
	if runtimeGOOS == "darwin" {
		prefer, other = "zsh", "bash"
	}
	var out []Shell
	if s, ok := findNamed(prefer, prefer, unixDashC()); ok {
		out = append(out, s)
	}
	if s, ok := findNamed(other, other, unixDashC()); ok {
		out = append(out, s)
	}
	out = append(out, unixSh())
	return out
}

func pickAutoShell(available []Shell) Shell {
	if id := autoShellID(); id != "" {
		if s, ok := shellByID(available, id); ok {
			return s
		}
		if s, ok := shellByID(available, "sh"); ok {
			return s
		}
	}
	return available[0]
}

func autoShellID() string {
	switch runtimeGOOS {
	case "darwin":
		return "zsh"
	case "windows":
		return ""
	default:
		return "bash"
	}
}

func shellByID(shells []Shell, id string) (Shell, bool) {
	for _, s := range shells {
		if s.ID == id {
			return s, true
		}
	}
	return Shell{}, false
}

func unixDashC() []string { return []string{"-c"} }

func unixSh() Shell {
	path, err := lookPath("sh")
	if err != nil {
		path = "/bin/sh"
	}
	return Shell{ID: "sh", Name: "sh", Path: path, args: unixDashC()}
}

func detectWindowsShells() []Shell {
	var out []Shell
	if s, ok := findBash(); ok {
		out = append(out, s)
	}
	if s, ok := findNamed("pwsh", "PowerShell 7", psFlags()); ok {
		out = append(out, s)
	}
	if s, ok := findPowerShell(); ok {
		out = append(out, s)
	}
	out = append(out, windowsCmd())
	return out
}

func psFlags() []string {
	return []string{"-NoProfile", "-NonInteractive", "-EncodedCommand"}
}

func findBash() (Shell, bool) {
	if p, err := lookPath("bash"); err == nil {
		return Shell{ID: "bash", Name: "Git Bash", Path: p, args: []string{"-lc"}}, true
	}
	for _, c := range gitBashCandidates() {
		if pathExists(c) {
			return Shell{ID: "bash", Name: "Git Bash", Path: c, args: []string{"-lc"}}, true
		}
	}
	return Shell{}, false
}

func gitBashCandidates() []string {
	var roots []string
	for _, env := range []string{"ProgramFiles", "ProgramFiles(x86)"} {
		if v := os.Getenv(env); v != "" {
			roots = append(roots, v)
		}
	}
	if local := os.Getenv("LOCALAPPDATA"); local != "" {
		roots = append(roots, filepath.Join(local, "Programs"))
	}
	out := make([]string, 0, len(roots))
	for _, root := range roots {
		out = append(out, filepath.Join(root, "Git", "bin", "bash.exe"))
	}
	return out
}

func findNamed(id, name string, args []string) (Shell, bool) {
	p, err := lookPath(id)
	if err != nil {
		return Shell{}, false
	}
	return Shell{ID: id, Name: name, Path: p, args: args}, true
}

func findPowerShell() (Shell, bool) {
	if s, ok := findNamed("powershell", "PowerShell", psFlags()); ok {
		return s, true
	}
	root := os.Getenv("SystemRoot")
	if root == "" {
		return Shell{}, false
	}
	p := filepath.Join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
	if !pathExists(p) {
		return Shell{}, false
	}
	return Shell{ID: "powershell", Name: "PowerShell", Path: p, args: psFlags()}, true
}

func windowsCmd() Shell {
	args := []string{"/c"}
	if p, err := lookPath("cmd"); err == nil {
		return Shell{ID: "cmd", Name: "Command Prompt", Path: p, args: args}
	}
	root := os.Getenv("SystemRoot")
	path := "cmd.exe"
	if root != "" {
		path = filepath.Join(root, "System32", "cmd.exe")
	}
	return Shell{ID: "cmd", Name: "Command Prompt", Path: path, args: args}
}
