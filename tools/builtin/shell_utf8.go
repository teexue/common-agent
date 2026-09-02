package builtin

import (
	"encoding/base64"
	"encoding/binary"
	"os"
	"os/exec"
	"strings"
	"unicode/utf16"
)

const psUTF8Preamble = "$u = New-Object System.Text.UTF8Encoding $false; " +
	"[Console]::InputEncoding = $u; [Console]::OutputEncoding = $u; " +
	"$OutputEncoding = $u; "

func (s Shell) argv(script string) (string, []string) {
	return s.Path, append(append([]string{}, s.args...), s.prepareScript(script))
}

func (s Shell) prepareScript(script string) string {
	if runtimeGOOS != "windows" {
		return script
	}
	switch s.ID {
	case "cmd":
		return "chcp 65001>nul & " + script
	case "powershell", "pwsh":
		return encodePSCommand(psUTF8Preamble + script)
	case "bash":
		return "chcp.com 65001 >/dev/null 2>&1; " + script
	default:
		return script
	}
}

func encodePSCommand(script string) string {
	u := utf16.Encode([]rune(script))
	b := make([]byte, len(u)*2)
	for i, r := range u {
		binary.LittleEndian.PutUint16(b[i*2:], r)
	}
	return base64.StdEncoding.EncodeToString(b)
}

func applyWindowsConsole(cmd *exec.Cmd, sh Shell) {
	if runtimeGOOS != "windows" {
		return
	}
	env := cmd.Env
	if env == nil {
		env = os.Environ()
	}
	cmd.Env = mergeUTF8Env(env, sh.ID)
}

func mergeUTF8Env(base []string, shellID string) []string {
	extra := map[string]string{
		"PYTHONIOENCODING": "utf-8",
		"PYTHONUTF8":       "1",
		"LESSCHARSET":      "utf-8",
	}
	if shellID == "bash" || shellID == "sh" {
		extra["LANG"] = "C.UTF-8"
		extra["LC_ALL"] = "C.UTF-8"
		extra["LC_CTYPE"] = "C.UTF-8"
	}
	return upsertEnv(base, extra)
}

func upsertEnv(base []string, extra map[string]string) []string {
	pending := make(map[string]string, len(extra))
	for k, v := range extra {
		pending[strings.ToUpper(k)] = v
	}
	out := make([]string, 0, len(base)+len(extra))
	for _, kv := range base {
		k, _, ok := strings.Cut(kv, "=")
		if !ok {
			out = append(out, kv)
			continue
		}
		uk := strings.ToUpper(k)
		if v, hit := pending[uk]; hit {
			out = append(out, k+"="+v)
			delete(pending, uk)
			continue
		}
		out = append(out, kv)
	}
	for k, v := range extra {
		if _, hit := pending[strings.ToUpper(k)]; hit {
			out = append(out, k+"="+v)
		}
	}
	return out
}
