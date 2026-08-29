//go:build integration

package integration

import (
	"bufio"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestToolApprovalRound(t *testing.T) {
	srv := newRunServer(t, gatedAgentYAML, toolCallMock())
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)

	body, err := json.Marshal(map[string]string{"agent": "test", "prompt": "use the tool"})
	require.NoError(t, err)
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/v1/agents/run", bytes.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	require.Equal(t, http.StatusOK, resp.StatusCode)

	sc := bufio.NewScanner(resp.Body)
	var types []string
	approved := false
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		var ev map[string]any
		require.NoError(t, json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &ev))
		typ, _ := ev["type"].(string)
		types = append(types, typ)
		if typ == "tool_approval_required" && !approved {
			id, _ := ev["approval_id"].(string)
			require.NotEmpty(t, id)
			postApprove(t, ts.URL, id)
			approved = true
		}
		if typ == "done" {
			break
		}
	}
	require.NoError(t, sc.Err())
	require.True(t, approved)
	require.Contains(t, types, "tool_approval_required")
	require.Contains(t, types, "tool_result")
	require.Contains(t, types, "done")
}

func postApprove(t *testing.T, base, approvalID string) {
	t.Helper()
	body, err := json.Marshal(map[string]any{"approval_id": approvalID, "approved": true})
	require.NoError(t, err)
	resp, err := http.Post(base+"/v1/agents/approve", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	require.Equal(t, http.StatusOK, resp.StatusCode)
}
