package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseCommand(t *testing.T) {
	tests := []struct {
		name string
		args []string
		cmd  string
		rest []string
	}{
		{name: "no args defaults to web", args: nil, cmd: "web", rest: nil},
		{name: "web", args: []string{"web"}, cmd: "web", rest: []string{}},
		{name: "web with flags", args: []string{"web", "--addr", ":9090"}, cmd: "web", rest: []string{"--addr", ":9090"}},
		{name: "serve is web alias", args: []string{"serve", "--addr", ":9090"}, cmd: "web", rest: []string{"--addr", ":9090"}},
		{name: "bare flags start web", args: []string{"--addr", ":9090"}, cmd: "web", rest: []string{"--addr", ":9090"}},
		{name: "help short", args: []string{"-h"}, cmd: "help", rest: nil},
		{name: "help long", args: []string{"--help"}, cmd: "help", rest: nil},
		{name: "version", args: []string{"version"}, cmd: "version", rest: []string{}},
		{name: "config kept", args: []string{"config", "init"}, cmd: "config", rest: []string{"init"}},
		{name: "hidden chat still routes", args: []string{"chat"}, cmd: "chat", rest: []string{}},
		{name: "unknown", args: []string{"nope"}, cmd: "", rest: nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd, rest := parseCommand(tt.args)
			assert.Equal(t, tt.cmd, cmd)
			assert.Equal(t, tt.rest, rest)
		})
	}
}
