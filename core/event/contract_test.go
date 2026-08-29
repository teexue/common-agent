package event_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/teexue/common-agent/core/event"
)

func TestAllTypesCoversConstDeclarations(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	require.True(t, ok)
	src, err := os.ReadFile(filepath.Join(filepath.Dir(file), "event.go"))
	require.NoError(t, err)
	re := regexp.MustCompile(`Type\w+\s+Type = "([^"]+)"`)
	declared := map[string]struct{}{}
	for _, m := range re.FindAllSubmatch(src, -1) {
		declared[string(m[1])] = struct{}{}
	}
	listed := map[string]struct{}{}
	for _, typ := range event.AllTypes() {
		listed[string(typ)] = struct{}{}
	}
	require.Equal(t, declared, listed)
}

func TestAllTypesJSONRoundTrip(t *testing.T) {
	for _, typ := range event.AllTypes() {
		data, err := json.Marshal(event.Event{Type: typ})
		require.NoError(t, err, string(typ))
		var ev event.Event
		require.NoError(t, json.Unmarshal(data, &ev), string(typ))
		require.Equal(t, typ, ev.Type)
	}
}
