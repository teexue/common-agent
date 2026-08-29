package event_test

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/teexue/common-agent/core/event"
)

func TestConsumersDeclareAllTypes(t *testing.T) {
	root := eventRepoRoot(t)
	want := allTypeSet()
	require.Equal(t, want, quotedStringsInRange(t,
		filepath.Join(root, "sdk/ts/src/types.ts"),
		"export const ALL_EVENT_TYPES", "export type EventType"))
	require.Equal(t, want, quotedStringsInRange(t,
		filepath.Join(root, "sdk/python/src/common_agent_sdk/types.py"),
		"class EventType", "class AgentEvent"))
	require.Equal(t, want, handlerKeys(t,
		filepath.Join(root, "frontend/src/hooks/chat-sse.ts")))
}

func TestPrintEventsSwitchCoversAllTypes(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	require.True(t, ok)
	src, err := os.ReadFile(filepath.Join(filepath.Dir(file), "event.go"))
	require.NoError(t, err)
	body := braceBody(string(src), "func PrintEvents")
	require.NotEmpty(t, body)
	for _, name := range typeConstNames(string(src)) {
		require.Contains(t, body, name)
	}
}

func eventRepoRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	require.True(t, ok)
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

func allTypeSet() map[string]struct{} {
	out := map[string]struct{}{}
	for _, typ := range event.AllTypes() {
		out[string(typ)] = struct{}{}
	}
	return out
}

func quotedStringsInRange(t *testing.T, path, start, end string) map[string]struct{} {
	t.Helper()
	data, err := os.ReadFile(path)
	require.NoError(t, err, path)
	src := string(data)
	i := strings.Index(src, start)
	require.GreaterOrEqual(t, i, 0, path+" missing "+start)
	j := strings.Index(src[i:], end)
	require.GreaterOrEqual(t, j, 0, path+" missing "+end)
	block := src[i : i+j]
	re := regexp.MustCompile(`"([a-z_]+)"`)
	out := map[string]struct{}{}
	for _, m := range re.FindAllStringSubmatch(block, -1) {
		out[m[1]] = struct{}{}
	}
	return out
}

func handlerKeys(t *testing.T, path string) map[string]struct{} {
	t.Helper()
	data, err := os.ReadFile(path)
	require.NoError(t, err, path)
	block := braceBody(string(data), "const HANDLERS")
	require.NotEmpty(t, block)
	re := regexp.MustCompile(`(?m)^\s+([a-z_]+):`)
	out := map[string]struct{}{}
	for _, m := range re.FindAllStringSubmatch(block, -1) {
		out[m[1]] = struct{}{}
	}
	return out
}

func typeConstNames(src string) []string {
	re := regexp.MustCompile(`(Type\w+)\s+Type = "`)
	var names []string
	for _, m := range re.FindAllStringSubmatch(src, -1) {
		names = append(names, m[1])
	}
	return names
}

func braceBody(src, sig string) string {
	i := strings.Index(src, sig)
	if i < 0 {
		return ""
	}
	open := strings.Index(src[i:], "{")
	if open < 0 {
		return ""
	}
	start := i + open
	depth := 0
	for j := start; j < len(src); j++ {
		switch src[j] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return src[start : j+1]
			}
		}
	}
	return ""
}
