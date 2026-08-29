package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tui"
)

func main() {
	locale := i18n.ResolveLocale("", "")
	bundle, err := i18n.NewBundle(locale)
	if err != nil {
		bundle = i18n.Global()
	} else {
		i18n.SetGlobal(bundle)
	}
	logger := slog.New(i18n.NewSlogHandler(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}), bundle))
	slog.SetDefault(logger)

	cmd, rest := parseCommand(os.Args[1:])
	switch cmd {
	case "web":
		runWeb(rest, logger)
	case "run":
		runCLI(rest, logger)
	case "chat":
		runChat(rest, logger)
	case "sessions":
		runSessions(rest, logger)
	case "tools":
		runTools(rest, logger)
	case "config":
		runConfig(rest)
	case "templates":
		runTemplates(rest)
	case "validate":
		runValidate(rest)
	case "skills":
		runSkills(rest)
	case "version":
		runVersion(rest)
	case "help":
		usage()
	default:
		usage()
		os.Exit(1)
	}
}

// parseCommand maps argv to a subcommand. No args, or a leading flag, starts Web.
func parseCommand(args []string) (cmd string, rest []string) {
	if len(args) == 0 {
		return "web", nil
	}
	switch args[0] {
	case "web", "serve":
		return "web", args[1:]
	case "help", "-h", "--help":
		return "help", nil
	case "version", "-v", "--version":
		return "version", args[1:]
	case "run", "chat", "sessions", "tools", "config", "templates", "validate", "skills":
		return args[0], args[1:]
	default:
		if strings.HasPrefix(args[0], "-") {
			return "web", args
		}
		return "", nil
	}
}

// newLocaleLogger builds a slog logger that translates log catalog keys.
func newLocaleLogger(flagLocale, settingsLocale string) *slog.Logger {
	locale := i18n.ResolveLocale(flagLocale, settingsLocale)
	bundle, err := i18n.NewBundle(locale)
	if err != nil {
		bundle = i18n.Global()
	} else {
		i18n.SetGlobal(bundle)
	}
	logger := slog.New(i18n.NewSlogHandler(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}), bundle))
	slog.SetDefault(logger)
	return logger
}

func usage() {
	fmt.Fprint(os.Stderr, i18n.T("cli.usage.main"))
}

// stringList is a repeatable flag.Value for collecting multiple --api-key values.
type stringList []string

func (s *stringList) String() string { return fmt.Sprint([]string(*s)) }
func (s *stringList) Set(v string) error {
	*s = append(*s, v)
	return nil
}

func runCLI(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	agentName := fs.String("agent", "", i18n.T("cli.flag.agent"))
	prompt := fs.String("prompt", "", i18n.T("cli.flag.prompt"))
	format := fs.String("format", "text", i18n.T("cli.flag.format"))
	homeFlag := fs.String("home", "", i18n.T("cli.flag.home_short"))
	localeFlag := fs.String("locale", "", i18n.T("cli.flag.locale"))
	mock := fs.Bool("mock", false, i18n.T("cli.flag.mock"))
	_ = fs.Parse(args)

	if *format != "text" && *format != "json" {
		fmt.Fprintln(os.Stderr, i18n.T("cli.error.format_invalid"))
		os.Exit(1)
	}
	if *prompt == "" {
		fmt.Fprintln(os.Stderr, i18n.T("cli.error.prompt_required"))
		os.Exit(1)
	}

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		logger.Error("log.cmd.resolve_paths", "error", err)
		os.Exit(1)
	}
	catalog, creds, stateDB, err := bootstrapRuntime(paths, *mock, logger)
	if err != nil {
		logger.Error("log.cmd.bootstrap", "error", err)
		os.Exit(1)
	}
	if stateDB != nil {
		defer stateDB.Close()
	}

	settings, err := config.LoadSettings(paths.home)
	if err != nil {
		logger.Error("log.config.load_settings", "error", err)
		os.Exit(1)
	}
	logger = newLocaleLogger(*localeFlag, settings.Locale)
	name := *agentName
	if name == "" {
		name = settings.DefaultAgent
	}

	a, err := agent.LoadByName(paths.agentsDir, service.NormalizeAgentName(name))
	if err != nil {
		logger.Error("log.agent.load", "error", err)
		os.Exit(1)
	}

	p, err := resolveProvider(catalog, *mock)(a)
	if err != nil {
		logger.Error("log.provider.create", "error", err)
		os.Exit(1)
	}

	// In-pipeline user prompt optimization (agent-driven, non-fatal).
	optimizedPrompt := service.OptimizeUserPrompt(context.Background(), a, p, *prompt, logger)

	reg := newRegistry("") // uses current working directory
	if !*mock {
		registerRuntimeTools(reg, paths, settings, creds, logger)
	}
	sess := session.New(a.Name)
	events, err := loop.Run(context.Background(), loop.Config{
		Provider: p, Registry: reg, Agent: a, Session: sess, Prompt: optimizedPrompt,
	})
	if err != nil {
		logger.Error("log.agent.run", "error", err)
		os.Exit(1)
	}

	outputCLIResult(CLIOutputConfig{Format: *format, Events: events, Session: sess, Agent: a, Paths: paths, Logger: logger})
}

// CLIOutputConfig holds configuration for CLI output formatting.
type CLIOutputConfig struct {
	Format  string
	Events  <-chan event.Event
	Session *session.Session
	Agent   *agent.Agent
	Paths   runtimePaths
	Logger  *slog.Logger
}

// outputCLIResult writes agent run results in the requested format.
func outputCLIResult(cfg CLIOutputConfig) {
	if cfg.Format == "json" {
		if err := event.StreamEvents(context.Background(), os.Stdout, cfg.Events); err != nil {
			cfg.Logger.Error("log.event.stream", "error", err)
			os.Exit(1)
		}
		return
	}
	cfg.Logger.Info("log.agent.run_started", "session_id", cfg.Session.ID, "agent", cfg.Agent.Name, "provider", cfg.Agent.Provider, "model", cfg.Agent.Model, "home", cfg.Paths.home)
	tui.PrintEvents(cfg.Events)
}

func runTools(args []string, _ *slog.Logger) {
	fs := flag.NewFlagSet("tools", flag.ExitOnError)
	agentName := fs.String("agent", "", i18n.T("cli.flag.agent_validate"))
	_ = fs.Parse(args)

	home, err := config.Home(false)
	if err != nil {
		fmt.Fprintln(os.Stderr, i18n.T("cli.error.generic", "error", err.Error()))
		os.Exit(1)
	}
	reg := newRegistry("") // uses current working directory

	if *agentName != "" {
		// Validate agent tools against registry.
		a, err := agent.LoadByNameAndValidate(config.AgentsDir(home), *agentName, reg.Names())
		if err != nil {
			fmt.Fprintln(os.Stderr, i18n.T("cli.error.generic", "error", err.Error()))
			os.Exit(1)
		}
		fmt.Println(i18n.T("cli.tools.validated_ok", "name", a.Name, "tools", fmt.Sprint(a.Tools)))
		return
	}

	// List all registered tools.
	names := reg.Names()
	if len(names) == 0 {
		fmt.Println(i18n.T("cli.tools.none"))
		return
	}
	fmt.Println(i18n.T("cli.tools.registered_header", "count", len(names)))
	for _, t := range reg.List() {
		fmt.Printf("  %-20s %s\n", t.Name(), t.Description())
	}
}
