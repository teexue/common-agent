package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/teexue/common-agent/core/config"
)

func runTemplates(args []string) {
	if len(args) == 0 {
		printTemplatesUsage()
		return
	}

	switch args[0] {
	case "list":
		runTemplatesList()
	case "install":
		runTemplatesInstall(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", args[0])
		printTemplatesUsage()
		os.Exit(1)
	}
}

func printTemplatesUsage() {
	fmt.Println("Usage: agent-server templates <subcommand>")
	fmt.Println()
	fmt.Println("Subcommands:")
	fmt.Println("  list               List available agent templates")
	fmt.Println("  install [name...]  Install templates (default: all)")
	fmt.Println()
}

func runTemplatesList() {
	fmt.Println("Available agent templates:")
	fmt.Println()
	for _, t := range config.Templates {
		fmt.Printf("  %-20s %s\n", t.Name, t.Description)
	}
}

func runTemplatesInstall(args []string) {
	fs := flag.NewFlagSet("templates install", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home (default ~/.common-agent)")
	_ = fs.Parse(args)

	home := *homeFlag
	if home == "" {
		var err error
		home, err = config.Home(true)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
	}

	// If specific template names are provided, install those.
	remaining := fs.Args()
	if len(remaining) > 0 {
		for _, name := range remaining {
			if err := config.InstallTemplate(home, name, false); err != nil {
				fmt.Fprintf(os.Stderr, "error installing %q: %v\n", name, err)
				continue
			}
			fmt.Printf("Installed: %s\n", name)
		}
		return
	}

	// Otherwise install all templates.
	installed, skipped, err := config.InstallAllTemplates(home)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	for _, name := range installed {
		fmt.Printf("Installed: %s\n", name)
	}
	for _, name := range skipped {
		fmt.Printf("Skipped (exists): %s\n", name)
	}
}
