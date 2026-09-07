package main

import (
	"context"
	"errors"
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
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tui"
	"github.com/teexue/common-agent/tools/registry"
)

// chatState is the REPL-scoped wiring: one shared Service plus the currently
// selected agent and session handles. Per-turn state (provider, policy, MCP,
// skills) is rebuilt by PrepareRun each turn, matching the Web path.
type chatState struct {
	svc      *service.Service
	paths    runtimePaths
	agent    string
	sess     *session.Session // nil = start a new session on the next turn
	reg      *registry.Registry
	readline *readline.Instance
	sigCtx   context.Context // SIGINT/SIGTERM-cancelled base for run contexts
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
	name := *agentName
	if name == "" {
		name = settings.DefaultAgent
	}

	reg := newRegistry("")
	svc := wireCLIService(cliServiceConfig{
		paths: paths, reg: reg, catalog: catalog,
		creds: creds, stateDB: stateDB, settings: settings,
		mock: *mock, logger: logger,
	})

	// Resolve the agent up front so a bad name fails before the REPL starts;
	// later turns re-resolve through PrepareRun like the Web path does.
	a, err := svc.GetAgent(name)
	if err != nil {
		logger.Error("log.agent.load", "error", err)
		os.Exit(1)
	}

	rl, err := newChatReadline(paths.home)
	if err != nil {
		logger.Error("log.chat.readline", "error", err)
		os.Exit(1)
	}
	defer rl.Close()

	// Track the stable ID so session attribution matches PrepareRun / resume.
	state := &chatState{svc: svc, paths: paths, agent: a.ID, reg: reg, readline: rl}
	defer withSignalContext(state)()
	tui.PrintWelcome(a.Name, a.Provider, a.Model)
	runChatLoop(state)
}

// withSignalContext registers SIGINT/SIGTERM cancellation for the REPL and
// returns the stop func for the caller to defer.
func withSignalContext(state *chatState) func() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	state.sigCtx = ctx
	return stop
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

// runChatLoop runs the interactive chat REPL until the user exits.
func runChatLoop(state *chatState) {
	for {
		line, err := state.readline.Readline()
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
		runChatTurn(line, state)
	}
}

// runChatTurn prepares and executes one user turn via the shared service.
func runChatTurn(line string, state *chatState) {
	runCtx, cancel := context.WithCancel(state.sigCtx)
	defer cancel()

	result, err := prepareChatTurn(line, state, runCtx)
	if err != nil {
		fmt.Println(tui.Error(err.Error()))
		return
	}
	defer result.Cleanup(state.svc.Registry)
	state.sess = result.Session

	events, err := loop.Run(runCtx, result.Config)
	if err != nil {
		fmt.Println(tui.Error(err.Error()))
		return
	}
	tui.PrintEvents(events)
}

// chatTurnRequest builds the PrepareRun request for one REPL turn. The first
// turn (sess nil) passes no SessionID so PrepareRun creates the session; later
// turns resume it by id. Without a store the conversation is replayed via
// Messages so history survives across turns.
func chatTurnRequest(line string, state *chatState) service.RunRequest {
	req := service.RunRequest{Agent: state.agent, Prompt: line, Source: "chat"}
	if state.sess == nil {
		return req
	}
	if state.svc.Store != nil {
		req.SessionID = state.sess.ID
		return req
	}
	req.Messages = state.sess.GetMessages()
	return req
}

// prepareChatTurn calls PrepareRun, falling back to a fresh session (history
// replayed) when the persisted session was deleted while the REPL is open.
func prepareChatTurn(line string, state *chatState, ctx context.Context) (*service.RunResult, error) {
	req := chatTurnRequest(line, state)
	result, err := state.svc.PrepareRun(ctx, req, CLIApprover{})
	if err == nil || state.sess == nil || !errors.Is(err, session.ErrNotFound) {
		return result, err
	}
	req.SessionID = ""
	req.Messages = state.sess.GetMessages()
	return state.svc.PrepareRun(ctx, req, CLIApprover{})
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
		return handleClearCommand(state)
	case "/agent":
		return handleAgentCommand(parts, state)
	case "/tools":
		return handleToolsCommand(parts, state)
	default:
		fmt.Println(tui.Muted(i18n.T("tui.chat.unknown_command")))
		return false
	}
}

// handleClearCommand saves the current session (old /clear behavior) and
// resets to a fresh session on the next turn.
func handleClearCommand(state *chatState) bool {
	if state.svc.Store != nil && state.sess != nil {
		if err := state.svc.Store.Save(state.sess); err != nil {
			fmt.Println(tui.Error(i18n.T("tui.chat.save_session_failed", "error", err.Error())))
		} else {
			fmt.Println(tui.Muted(i18n.T("tui.chat.session_saved", "id", state.sess.ID)))
		}
	}
	state.sess = nil
	fmt.Println(tui.Muted(i18n.T("tui.chat.session_cleared")))
	return false
}

// handleAgentCommand handles the /agent command — list or switch agents.
func handleAgentCommand(parts []string, state *chatState) bool {
	if len(parts) < 2 {
		return listChatAgents(state)
	}
	// Probe the agent through the service so failures surface before switching.
	a, err := state.svc.GetAgent(parts[1])
	if err != nil {
		fmt.Println(tui.Error(err.Error()))
		return false
	}
	// Track the stable ID so session attribution and lookups by ID stay
	// consistent regardless of how the user referenced the agent.
	state.agent = a.ID
	state.sess = nil
	fmt.Println(tui.Success(i18n.T("tui.chat.agent_switched", "agent", a.Name, "provider", a.Provider, "model", a.Model)))
	return false
}

// listChatAgents prints the available agents with the active one marked.
func listChatAgents(state *chatState) bool {
	agents, err := agent.LoadAll(state.paths.agentsDir)
	if err != nil {
		fmt.Println(tui.Error(err.Error()))
		return false
	}
	if len(agents.Agents) == 0 {
		fmt.Println(tui.Muted(i18n.T("tui.chat.no_agents")))
		return false
	}
	fmt.Println(tui.Muted(i18n.T("tui.chat.agents_header")))
	for _, a := range agents.Agents {
		marker := " "
		if a.ID == state.agent || a.Name == state.agent {
			marker = tui.Success("●")
		}
		fmt.Printf("  %s %s\n", marker, a.Name)
	}
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