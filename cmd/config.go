package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/provider"
)

func runConfig(args []string) {
	if len(args) == 0 {
		configUsage()
		os.Exit(1)
	}
	switch args[0] {
	case "init":
		runConfigInit(args[1:])
	case "show":
		runConfigShow(args[1:])
	case "path":
		runConfigPath(args[1:])
	case "set-key":
		runConfigSetKey(args[1:])
	case "set":
		runConfigSet(args[1:])
	default:
		configUsage()
		os.Exit(1)
	}
}

func configUsage() {
	fmt.Fprintf(os.Stderr, `Usage:
  agent-server config init [--home ~/.common-agent]
  agent-server config show [--home ~/.common-agent]
  agent-server config path
  agent-server config set-key MOONSHOT_API_KEY sk-...
  agent-server config set default-agent demo [--home ...]
  agent-server config set provider moonshot \
    --type openai --base-url https://api.moonshot.cn/v1 \
    --api-key-env MOONSHOT_API_KEY --model kimi-k2.6 [--thinking disabled]
`)
}

func runConfigInit(args []string) {
	fs := flag.NewFlagSet("config init", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home (default ~/.common-agent)")
	_ = fs.Parse(args)

	home, err := config.Home(true)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if *homeFlag != "" {
		home = *homeFlag
		if err := config.InstallDefaults(home); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	}

	if err := config.InitInteractive(home); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runConfigShow(args []string) {
	fs := flag.NewFlagSet("config show", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home")
	_ = fs.Parse(args)

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	printPaths(paths)

	settings, err := config.LoadSettings(paths.home)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("\ndefault_agent: %s\n", settings.DefaultAgent)

	creds, err := config.NewCredentialStore(paths.home)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	credKeys := creds.Keys()
	if len(credKeys) > 0 {
		fmt.Println("\ncredentials (keys only):")
		for _, k := range credKeys {
			fmt.Printf("  - %s\n", k)
		}
	}

	catalog, err := provider.LoadCatalog(paths.providers, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "\nproviders: not configured (%v)\n", err)
		return
	}
	fmt.Println("\nproviders:")
	for _, name := range catalog.Names() {
		fmt.Printf("  - %s\n", name)
	}
}

func runConfigPath(args []string) {
	fs := flag.NewFlagSet("config path", flag.ExitOnError)
	_ = fs.Parse(args)
	paths, err := defaultPaths()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(paths.home)
}

func runConfigSetKey(args []string) {
	fs := flag.NewFlagSet("config set-key", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home")
	_ = fs.Parse(args)

	if len(fs.Args()) != 2 {
		fmt.Fprintln(os.Stderr, "usage: agent-server config set-key ENV_NAME API_KEY")
		os.Exit(1)
	}
	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
		creds, err := config.NewCredentialStore(paths.home)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := creds.Set(fs.Args()[0], fs.Args()[1]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("saved %s to %s\n", fs.Args()[0], config.CredentialsFile(paths.home))
}

func runConfigSet(args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: agent-server config set default-agent NAME | provider NAME ...")
		os.Exit(1)
	}
	switch args[0] {
	case "default-agent":
		runConfigSetDefaultAgent(args[1:])
	case "provider":
		runConfigSetProvider(args[1:])
	default:
		fmt.Fprintln(os.Stderr, "unknown config set target:", args[0])
		os.Exit(1)
	}
}

func runConfigSetDefaultAgent(args []string) {
	fs := flag.NewFlagSet("config set default-agent", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home")
	_ = fs.Parse(args)
	if len(fs.Args()) != 1 {
		fmt.Fprintln(os.Stderr, "usage: agent-server config set default-agent NAME")
		os.Exit(1)
	}
	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := config.SaveSettings(paths.home, config.Settings{DefaultAgent: fs.Args()[0]}); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("default agent updated")
}

func runConfigSetProvider(args []string) {
	fs := flag.NewFlagSet("config set provider", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home")
	pType := fs.String("type", "openai", "provider type: anthropic|openai")
	baseURL := fs.String("base-url", "", "API base URL")
	apiKeyEnv := fs.String("api-key-env", "", "environment variable name for API key")
	apiVersion := fs.String("api-version", "", "anthropic API version")
	model := fs.String("model", "", "default model name")
	thinking := fs.String("thinking", "", "thinking mode: enabled|disabled")
	thinkingKeep := fs.String("thinking-keep", "", "thinking keep: all")
	_ = fs.Parse(args)

	if len(fs.Args()) != 1 {
		fmt.Fprintln(os.Stderr, "usage: agent-server config set provider NAME [flags]")
		os.Exit(1)
	}
	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	spec := config.ProviderSpec{
		Name:         fs.Args()[0],
		Type:         provider.Kind(*pType),
		BaseURL:      *baseURL,
		APIKeyEnv:    *apiKeyEnv,
		APIVersion:   *apiVersion,
		DefaultModel: *model,
		ThinkingType: *thinking,
		ThinkingKeep: *thinkingKeep,
	}
	if spec.APIKeyEnv == "" {
		spec.APIKeyEnv = strings.ToUpper(spec.Name) + "_API_KEY"
	}
	if err := config.UpsertProvider(paths.home, spec); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("provider %q updated in %s\n", spec.Name, config.ProvidersFile(paths.home))
}
