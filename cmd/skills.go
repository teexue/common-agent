package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/i18n"
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
		fmt.Fprintln(os.Stderr, i18n.T("cli.error.unknown_subcommand", "name", args[0]))
		printSkillsUsage()
		os.Exit(1)
	}
}

func printSkillsUsage() {
	fmt.Print(i18n.T("cli.usage.skills"))
}

func skillsDir(home string) string {
	return filepath.Join(home, "skills")
}

func runSkillsList(args []string) {
	fs := flag.NewFlagSet("skills list", flag.ExitOnError)
	homeFlag := fs.String("home", "", i18n.T("cli.flag.home"))
	_ = fs.Parse(args)

	home := resolveHome(*homeFlag)
	dir := skillsDir(home)

	loader := skill.NewLoader(dir)
	skills, err := loader.LoadAll()
	if err != nil {
		fmt.Fprintln(os.Stderr, i18n.T("cli.warning.generic", "error", err.Error()))
	}

	if len(skills) == 0 {
		fmt.Println(i18n.T("cli.skills.none"))
		fmt.Println(i18n.T("cli.skills.directory", "path", dir))
		return
	}

	fmt.Println(i18n.T("cli.skills.installed_header", "count", len(skills)))
	fmt.Println()
	for _, s := range skills {
		toolNames := s.ToolNames()
		fmt.Printf("  %-20s v%-8s [%s] %s\n", s.Name, s.Version, s.Format, s.Description)
		if len(toolNames) > 0 {
			fmt.Println(i18n.T("cli.skills.tools_line", "name", fmt.Sprintf("%-20s", ""), "tools", fmt.Sprint(toolNames)))
		}
		fmt.Println()
	}
}

func runSkillsValidate(args []string) {
	fs := flag.NewFlagSet("skills validate", flag.ExitOnError)
	homeFlag := fs.String("home", "", i18n.T("cli.flag.home"))
	_ = fs.Parse(args)

	home := resolveHome(*homeFlag)
	dir := skillsDir(home)

	loader := skill.NewLoader(dir)
	skills, err := loader.LoadAll()
	if err != nil {
		fmt.Fprintln(os.Stderr, i18n.T("cli.skills.load_warning", "error", err.Error()))
	}

	if len(skills) == 0 {
		fmt.Println(i18n.T("cli.skills.none_to_validate"))
		return
	}

	exitCode := 0
	for _, s := range skills {
		toolNames := s.ToolNames()
		fmt.Println(i18n.T("cli.skills.validate_ok", "name", s.Name, "version", s.Version, "format", s.Format, "tools", len(toolNames)))
	}
	os.Exit(exitCode)
}

func runSkillsInfo(args []string) {
	fs := flag.NewFlagSet("skills info", flag.ExitOnError)
	homeFlag := fs.String("home", "", i18n.T("cli.flag.home"))
	_ = fs.Parse(args)

	if fs.NArg() == 0 {
		fmt.Fprintln(os.Stderr, i18n.T("cli.usage.skills_info"))
		os.Exit(1)
	}
	name := fs.Arg(0)

	home := resolveHome(*homeFlag)
	dir := skillsDir(home)

	loader := skill.NewLoader(dir)
	s, err := loader.LoadByName(name)
	if err != nil {
		fmt.Fprintln(os.Stderr, i18n.T("cli.error.generic", "error", err.Error()))
		os.Exit(1)
	}

	fmt.Printf("%-12s %s\n", i18n.T("cli.skills.info.name"), s.Name)
	fmt.Printf("%-12s %s\n", i18n.T("cli.skills.info.version"), s.Version)
	fmt.Printf("%-12s %s\n", i18n.T("cli.skills.info.format"), s.Format)
	fmt.Printf("%-12s %s\n", i18n.T("cli.skills.info.description"), s.Description)
	fmt.Printf("%-12s %s\n", i18n.T("cli.skills.info.directory"), s.Dir)

	if s.MDManifest != nil {
		fm := s.MDManifest.Frontmatter
		if fm.License != "" {
			fmt.Printf("%-12s %s\n", i18n.T("cli.skills.info.license"), fm.License)
		}
		if fm.Compatibility != "" {
			fmt.Printf("%-12s %s\n", i18n.T("cli.skills.info.compat"), fm.Compatibility)
		}
		if len(fm.Metadata) > 0 {
			fmt.Printf("%-12s %v\n", i18n.T("cli.skills.info.metadata"), fm.Metadata)
		}
		if fm.AllowedTools != "" {
			fmt.Printf("%-12s %s\n", i18n.T("cli.skills.info.allowed"), fm.AllowedTools)
		}
		if s.Body() != "" {
			fmt.Printf("\n%s\n%s\n", i18n.T("cli.skills.info.instructions"), s.Body())
		}
	}

	if s.LegacyManifest != nil {
		m := s.LegacyManifest
		if m.Author != "" {
			fmt.Printf("%-12s %s\n", i18n.T("cli.skills.info.author"), m.Author)
		}
		fmt.Println(i18n.T("cli.skills.info.tools_header", "count", len(m.Tools)))
		for _, t := range m.Tools {
			typ := t.Type
			if typ == "" {
				typ = i18n.T("cli.skills.tool_type_prompt")
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
		fmt.Fprintln(os.Stderr, i18n.T("cli.error.generic", "error", err.Error()))
		os.Exit(1)
	}
	return home
}
