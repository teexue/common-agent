package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/chzyer/readline"
	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tui"
	"github.com/teexue/common-agent/tools/registry"
)

type chatState struct {
	catalog  *provider.Catalog
	mock     bool
	paths    runtimePaths
	agent    *agent.Agent
	provider provider.Provider
	sess     *session.Session
	reg      *registry.Registry
	store    session.Store
}

func runChat(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("chat", flag.ExitOnError)
	agentName := fs.String("agent", "", i18n.T("cli.flag.agent"))
	homeFlag := fs.String("home", "", i18n.T("cli.flag.home_short"))
	mock := fs.Bool("mock", false, i18n.T("cli.flag.mock"))
	_ = fs.Parse(args)

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		logger.Error("log.cmd.resolve_paths", "error", err)
		os.Exit(1)
	}
	catalog, _, err := bootstrapRuntime(paths, *mock, logger)
	if err != nil {
		logger.Error("log.cmd.bootstrap", "error", err)
		os.Exit(1)
	}

	settings, err := config.LoadSettings(paths.home)
	if err != nil {
		logger.Error("log.config.load_settings", "error", err)
		os.Exit(1)
	}
	name := *agentName
	if name == "" {
		name = settings.DefaultAgent
	}

	state, err := newChatState(catalog, *mock, paths, name)
	if err != nil {
		logger.Error("log.chat.init", "error", err)
		os.Exit(1)
	}

	tui.PrintWelcome(state.agent.Name, state.agent.Provider, state.agent.Model)

	rl, err := newChatReadline(paths.home)
	if err != nil {
		logger.Error("log.chat.readline", "error", err)
		os.Exit(1)
	}
	defer rl.Close()

	runChatLoop(rl, state)
}

func newChatReadline(home string) (*readline.Instance, error) {
	historyPath := filepath.Join(home, ".chat_history")
	return readline.NewEx(&readline.Config{
		Prompt:          tui.Prompt(),
		HistoryFile:     historyPath,
		HistoryLimit:    500,
		InterruptPrompt: "^C",
		EOFPrompt:       "/exit",
	})
}

func newChatState(catalog *provider.Catalog, mock bool, paths runtimePaths, agentName string) (*chatState, error) {
	a, err := agent.LoadByName(paths.agentsDir, service.NormalizeAgentName(agentName))
	if err != nil {
		return nil, err
	}
	p, err := resolveProvider(catalog, mock)(a)
	if err != nil {
		return nil, err
	}

	var store session.Store
	if !mock {
		store, err = session.NewFileStore(config.SessionsDir(paths.home))
		if err != nil {
			return nil, fmt.Errorf("open session store: %w", err)
		}
	}

	return &chatState{
		catalog:  catalog,
		mock:     mock,
		paths:    paths,
		agent:    a,
		provider: p,
		sess:     session.New(a.Name),
		reg:      newRegistry(""), // uses current working directory
		store:    store,
	}, nil
}

// runChatLoop runs the interactive chat REPL until the user exits.
func runChatLoop(rl *readline.Instance, state *chatState) {
	// Register signal handler once for the entire REPL session.
	sigCtx, sigStop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer sigStop()

	for {
		line, err := rl.Readline()
		if err != nil {
			fmt.Println()
			return
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "/") {
			if handleChatCommand(line, state) {
				return
			}
			continue
		}

		var pol permission.Policy
		if state.agent.Permissions != nil {
			pol = permission.NewAgentPolicy(*state.agent.Permissions)
		} else {
			pol = permission.AllowAllPolicy{}
		}

		// Derive a per-run cancel context from the signal context.
		runCtx, runCancel := context.WithCancel(sigCtx)
		events, err := loop.Run(runCtx, loop.Config{
			Provider: state.provider,
			Registry: state.reg,
			Agent:    state.agent,
			Session:  state.sess,
			Prompt:   line,
			Store:    state.store,
			Policy:   pol,
			Approver: CLIApprover{},
		})
		runCancel()
		if err != nil {
			fmt.Println(tui.Error(err.Error()))
			continue
		}
		tui.PrintEvents(events)
	}
}

// handleChatCommand processes a /command input; returns true to exit the REPL.
func handleChatCommand(line string, state *chatState) (exit bool) {
	parts := strings.Fields(line)
	switch parts[0] {
	case "/exit", "/quit":
		fmt.Println(tui.Muted(i18n.T("tui.chat.goodbye")))
		return true
	case "/help":
		tui.PrintHelp()
		return false
	case "/clear":
		if state.store != nil {
			if err := state.store.Save(state.sess); err != nil {
				fmt.Println(tui.Error(i18n.T("tui.chat.save_session_failed", "error", err.Error())))
			} else {
				fmt.Println(tui.Muted(i18n.T("tui.chat.session_saved", "id", state.sess.ID)))
			}
		}
		state.sess = session.New(state.agent.Name)
		fmt.Println(tui.Success(i18n.T("tui.chat.session_cleared")))
		return false
	case "/agent":
		return handleAgentCommand(parts, state)
	case "/tools":
		return handleToolsCommand(parts, state)
	default:
		fmt.Println(tui.Muted(i18n.T("tui.chat.unknown_command")))
		return false
	}
}

// handleAgentCommand handles the /agent command — list or switch agents.
func handleAgentCommand(parts []string, state *chatState) bool {
	if len(parts) < 2 {
		names, err := agent.ListAvailable(state.paths.agentsDir)
		if err != nil {
			fmt.Println(tui.Error(err.Error()))
			return false
		}
		if len(names) == 0 {
			fmt.Println(tui.Muted(i18n.T("tui.chat.no_agents")))
			return false
		}
		fmt.Println(tui.Muted(i18n.T("tui.chat.agents_header")))
		for _, n := range names {
			marker := " "
			if n == state.agent.Name {
				marker = tui.Success("●")
			}
			fmt.Printf("  %s %s\n", marker, n)
		}
		return false
	}
	loaded, err := agent.LoadByName(state.paths.agentsDir, parts[1])
	if err != nil {
		fmt.Println(tui.Error(err.Error()))
		return false
	}
	p, err := resolveProvider(state.catalog, state.mock)(loaded)
	if err != nil {
		fmt.Println(tui.Error(err.Error()))
		return false
	}
	state.agent = loaded
	state.provider = p
	state.sess = session.New(loaded.Name)
	fmt.Println(tui.Success(i18n.T("tui.chat.agent_switched", "agent", loaded.Name, "provider", loaded.Provider, "model", loaded.Model)))
	return false
}

// handleToolsCommand handles the /tools command — list or validate tools.
func handleToolsCommand(parts []string, state *chatState) bool {
	if len(parts) >= 2 {
		a, err := agent.LoadByNameAndValidate(state.paths.agentsDir, parts[1], state.reg.Names())
		if err != nil {
			fmt.Println(tui.Error(err.Error()))
			return false
		}
		fmt.Println(tui.Success(i18n.T("tui.chat.tools_validated", "agent", a.Name, "tools", fmt.Sprint(a.Tools))))
		return false
	}
	names := state.reg.Names()
	if len(names) == 0 {
		fmt.Println(tui.Muted(i18n.T("tui.chat.no_tools")))
		return false
	}
	fmt.Println(tui.Muted(i18n.T("tui.chat.tools_header", "count", len(names))))
	for _, t := range state.reg.List() {
		fmt.Printf("  %-16s %s\n", tui.Muted(t.Name()), t.Description())
	}
	return false
}
