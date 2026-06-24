package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/config"
)

func runValidate(args []string) {
	fs := flag.NewFlagSet("validate", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home (default ~/.common-agent)")
	_ = fs.Parse(args)

	if fs.NArg() == 0 {
		fmt.Fprintln(os.Stderr, "usage: agent-server validate <agent.yaml> [...]")
		os.Exit(1)
	}

	home := *homeFlag
	if home == "" {
		var err error
		home, err = config.Home(false)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
	}

	// Load all tool names from registry.
	reg := newRegistry(home)
	toolNames := reg.Names()

	exitCode := 0
	for _, path := range fs.Args() {
		a, err := agent.LoadAndValidate(path, toolNames)
		if err != nil {
			fmt.Fprintf(os.Stderr, "FAIL %s: %v\n", path, err)
			exitCode = 1
			continue
		}
		fmt.Printf("OK   %s (name=%s, provider=%s, model=%s, tools=%d)\n",
			path, a.Name, a.Provider, a.Model, len(a.Tools))
	}
	os.Exit(exitCode)
}
