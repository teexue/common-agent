package builtin_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/teexue/common-agent/tools/builtin"
)

func TestEcho(t *testing.T) {
	var e builtin.Echo
	input, _ := json.Marshal(map[string]string{"message": "hi"})
	res, err := e.Execute(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]string
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["message"] != "hi" {
		t.Fatalf("got %q", out["message"])
	}
}

func TestGetTime(t *testing.T) {
	var g builtin.GetTime
	res, err := g.Execute(context.Background(), json.RawMessage("{}"))
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]string
	if err := json.Unmarshal(res.Output, &out); err != nil {
		t.Fatal(err)
	}
	if out["time"] == "" {
		t.Fatal("expected time")
	}
}
