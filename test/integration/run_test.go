//go:build integration

package integration

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHTTPRunMockLoop(t *testing.T) {
	srv := newRunServer(t, runAgentYAML, textMock())
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)

	body, err := json.Marshal(map[string]string{"agent": "test", "prompt": "hello"})
	require.NoError(t, err)
	resp, err := http.Post(ts.URL+"/v1/agents/run", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))

	events := readAllSSE(t, resp.Body)
	types := eventTypes(events)
	require.Contains(t, types, "text_delta")
	require.Contains(t, types, "done")
	require.Contains(t, joinedContent(events), "hello from loop")
}

func readAllSSE(t *testing.T, r io.Reader) []map[string]any {
	t.Helper()
	var events []map[string]any
	sc := bufio.NewScanner(r)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		var ev map[string]any
		require.NoError(t, json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &ev))
		events = append(events, ev)
	}
	require.NoError(t, sc.Err())
	require.NotEmpty(t, events)
	return events
}

func eventTypes(events []map[string]any) []string {
	var out []string
	for _, ev := range events {
		if typ, ok := ev["type"].(string); ok {
			out = append(out, typ)
		}
	}
	return out
}

func joinedContent(events []map[string]any) string {
	var b strings.Builder
	for _, ev := range events {
		if ev["type"] == "text_delta" {
			if s, ok := ev["content"].(string); ok {
				b.WriteString(s)
			}
		}
	}
	return b.String()
}
