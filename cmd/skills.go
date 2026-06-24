package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/skill"
)

func runSkills(args []string) {
	if len(args) == 0 {
		printSkillsUsage()
		return
	}

	switch args[0] {
	case "list":
		runSkillsList(args[1:])
	case "validate":
		runSkillsValidate(args[1:])
	case "info":
		runSkillsInfo(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", args[0])
		printSkillsUsage()
		os.Exit(1)
	}
}

func printSkillsUsage() {
	fmt.Println("Usage: agent-server skills <subcommand>")
	fmt.Println()
	fmt.Println("Subcommands:")
	fmt.Println("  list               List installed skills")
	fmt.Println("  validate           Validate all skill manifests")
	fmt.Println("  info <name>        Show skill details")
	fmt.Println()
}

func skillsDir(home string) string {
	return filepath.Join(home, "skills")
}

func runSkillsList(args []string) {
	fs := flag.NewFlagSet("skills list", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home (default ~/.common-agent)")
	_ = fs.Parse(args)

	home := resolveHome(*homeFlag)
	dir := skillsDir(home)

	loader := skill.NewLoader(dir)
	skills, err := loader.LoadAll()
	if err != nil {
		fmt.Fprintf(os.Stderr, "warning: %v\n", err)
	}

	if len(skills) == 0 {
		fmt.Println("No skills installed.")
		fmt.Printf("Skills directory: %s\n", dir)
		return
	}

	fmt.Printf("Installed skills (%d):\n\n", len(skills))
	for _, s := range skills {
		toolNames := s.ToolNames()
		fmt.Printf("  %-20s v%-8s [%s] %s\n", s.Name, s.Version, s.Format, s.Description)
		if len(toolNames) > 0 {
			fmt.Printf("  %-20s tools: %v\n", "", toolNames)
		}
		fmt.Println()
	}
}

func runSkillsValidate(args []string) {
	fs := flag.NewFlagSet("skills validate", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home (default ~/.common-agent)")
	_ = fs.Parse(args)

	home := resolveHome(*homeFlag)
	dir := skillsDir(home)

	loader := skill.NewLoader(dir)
	skills, err := loader.LoadAll()
	if err != nil {
		fmt.Fprintf(os.Stderr, "warning: some skills failed to load: %v\n", err)
	}

	if len(skills) == 0 {
		fmt.Println("No skills found to validate.")
		return
	}

	exitCode := 0
	for _, s := range skills {
		toolNames := s.ToolNames()
		fmt.Printf("OK   %s (v%s, [%s], tools=%d)\n", s.Name, s.Version, s.Format, len(toolNames))
	}
	os.Exit(exitCode)
}

func runSkillsInfo(args []string) {
	fs := flag.NewFlagSet("skills info", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home (default ~/.common-agent)")
	_ = fs.Parse(args)

	if fs.NArg() == 0 {
		fmt.Fprintln(os.Stderr, "usage: agent-server skills info <name>")
		os.Exit(1)
	}
	name := fs.Arg(0)

	home := resolveHome(*homeFlag)
	dir := skillsDir(home)

	loader := skill.NewLoader(dir)
	s, err := loader.LoadByName(name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Name:        %s\n", s.Name)
	fmt.Printf("Version:     %s\n", s.Version)
	fmt.Printf("Format:      %s\n", s.Format)
	fmt.Printf("Description: %s\n", s.Description)
	fmt.Printf("Directory:   %s\n", s.Dir)

	if s.MDManifest != nil {
		fm := s.MDManifest.Frontmatter
		if fm.License != "" {
			fmt.Printf("License:     %s\n", fm.License)
		}
		if fm.Compatibility != "" {
			fmt.Printf("Compat:      %s\n", fm.Compatibility)
		}
		if len(fm.Metadata) > 0 {
			fmt.Printf("Metadata:    %v\n", fm.Metadata)
		}
		if fm.AllowedTools != "" {
			fmt.Printf("Allowed:     %s\n", fm.AllowedTools)
		}
		if s.Body() != "" {
			fmt.Printf("\n--- Instructions ---\n%s\n", s.Body())
		}
	}

	if s.LegacyManifest != nil {
		m := s.LegacyManifest
		if m.Author != "" {
			fmt.Printf("Author:      %s\n", m.Author)
		}
		fmt.Printf("\nTools (%d):\n", len(m.Tools))
		for _, t := range m.Tools {
			typ := t.Type
			if typ == "" {
				typ = "prompt"
			}
			fmt.Printf("  %-20s [%s] %s\n", t.Name, typ, t.Description)
		}
	}
}

func resolveHome(homeFlag string) string {
	if homeFlag != "" {
		return homeFlag
	}
	home, err := config.Home(false)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	return home
}
