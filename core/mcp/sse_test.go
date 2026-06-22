package mcp

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestSSEClient_JSONRPC tests the SSE client with a mock HTTP server.
func TestSSEClient_JSONRPC(t *testing.T) {
	var receivedRequests []Request

	mux := http.NewServeMux()

	// POST endpoint: receives requests and returns responses.
	mux.HandleFunc("/message", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req Request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		receivedRequests = append(receivedRequests, req)

		var resp Response
		resp.JSONRPC = "2.0"
		resp.ID = req.ID

		switch req.Method {
		case "initialize":
			resp.Result = json.RawMessage(`{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"mock-sse","version":"0.1"}}`)
		case "notifications/initialized":
			w.WriteHeader(http.StatusAccepted)
			return
		case "tools/list":
			resp.Result = json.RawMessage(`{"tools":[{"name":"sse_tool","description":"An SSE tool","inputSchema":{"type":"object"}}]}`)
		case "tools/call":
			resp.Result = json.RawMessage(`{"content":[{"type":"text","text":"sse result"}]}`)
		default:
			resp.Error = &RPCError{Code: -32601, Message: "method not found"}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	// Test POST-based request/response flow.
	initParams, _ := json.Marshal(InitializeParams{
		ProtocolVersion: "2024-11-05",
		Capabilities:    ClientCapabilities{Tools: &ToolsCapability{}},
		ClientInfo:      ClientInfo{Name: "test", Version: "0.1"},
	})

	req := Request{JSONRPC: "2.0", ID: 1, Method: "initialize", Params: initParams}
	body, _ := json.Marshal(req)

	resp, err := http.DefaultClient.Post(server.URL+"/message", "application/json", jsonReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var rpcResp Response
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		t.Fatal(err)
	}
	if rpcResp.ID != 1 {
		t.Errorf("expected ID 1, got %d", rpcResp.ID)
	}

	// Verify the server received the request.
	if len(receivedRequests) != 1 {
		t.Fatalf("expected 1 request, got %d", len(receivedRequests))
	}
	if receivedRequests[0].Method != "initialize" {
		t.Errorf("expected method 'initialize', got %q", receivedRequests[0].Method)
	}
}

func TestSSEClient_Close(t *testing.T) {
	client := NewSSEClient(SSEConfig{Name: "test", URL: "http://localhost:0"})
	if err := client.Close(); err != nil {
		t.Fatal(err)
	}
	// Double close should be safe.
	if err := client.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestSSEClient_Name(t *testing.T) {
	client := NewSSEClient(SSEConfig{Name: "my-server", URL: "http://localhost:0"})
	if client.Name() != "my-server" {
		t.Errorf("expected 'my-server', got %q", client.Name())
	}
}

// jsonReader creates a ReadCloser from a JSON byte slice.
func jsonReader(data []byte) *jsonReadCloser {
	return &jsonReadCloser{data: data}
}

type jsonReadCloser struct {
	data []byte
	pos  int
}

func (r *jsonReadCloser) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

func (r *jsonReadCloser) Close() error { return nil }

// suppress unused import
var _ = fmt.Sprintf
