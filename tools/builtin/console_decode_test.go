package builtin

import (
	"encoding/base64"
	"encoding/binary"
	"strings"
	"testing"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDecodeConsoleGBK(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "windows"
	testCodePage = 936
	t.Cleanup(func() { testCodePage = 0 })

	// GBK for 你好
	got := decodeConsole([]byte{0xC4, 0xE3, 0xBA, 0xC3})
	assert.Equal(t, "你好", got)
}

func TestDecodeConsoleKeepsUTF8(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "windows"
	testCodePage = 936
	t.Cleanup(func() { testCodePage = 0 })

	assert.Equal(t, "你好", decodeConsole([]byte("你好")))
}

func TestDecodeConsoleUnixLeavesBytes(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "linux"
	raw := []byte{0xC4, 0xE3, 0xBA, 0xC3}
	assert.Equal(t, string(raw), decodeConsole(raw))
}

func TestShellArgvWindowsUTF8(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "windows"

	cmd := Shell{ID: "cmd", Path: "cmd.exe", args: []string{"/c"}}
	_, argv := cmd.argv("echo 你好")
	require.Equal(t, []string{"/c", "chcp 65001>nul & echo 你好"}, argv)

	bash := Shell{ID: "bash", Path: "bash.exe", args: []string{"-lc"}}
	_, argv = bash.argv("echo 你好")
	require.Equal(t, []string{"-lc", "chcp.com 65001 >/dev/null 2>&1; echo 你好"}, argv)
}

func TestShellArgvPowerShellEncoded(t *testing.T) {
	t.Cleanup(restoreShellProbe)
	runtimeGOOS = "windows"
	ps := Shell{ID: "powershell", Path: "powershell.exe", args: psFlags()}
	_, argv := ps.argv("Write-Output 你好")
	require.Len(t, argv, 4)
	assert.Equal(t, "-EncodedCommand", argv[2])
	raw, err := base64.StdEncoding.DecodeString(argv[3])
	require.NoError(t, err)
	u16 := make([]uint16, len(raw)/2)
	for i := range u16 {
		u16[i] = binary.LittleEndian.Uint16(raw[i*2:])
	}
	script := string(utf16.Decode(u16))
	assert.Contains(t, script, "你好")
	assert.Contains(t, script, "UTF8Encoding")
}

func TestMergeUTF8Env(t *testing.T) {
	got := mergeUTF8Env([]string{"PATH=C:\\Windows", "PYTHONUTF8=0"}, "bash")
	assert.Contains(t, got, "PYTHONUTF8=1")
	assert.Contains(t, got, "LANG=C.UTF-8")
	assert.Contains(t, got, "PATH=C:\\Windows")
}

func TestCapOutputUTF8Boundary(t *testing.T) {
	s := "你好世界"
	got := capOutput(s, 4)
	assert.True(t, utf8.ValidString(got))
	trimmed := strings.TrimSuffix(got, "\n...[output truncated]")
	assert.True(t, utf8.ValidString(trimmed))
	assert.Equal(t, "你", trimmed)
}
