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
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tui"
	httpapi "github.com/teexue/common-agent/server/http"
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
	agentName := fs.String("agent", "", "agent name (default from config)")
	homeFlag := fs.String("home", "", "config home")
	mock := fs.Bool("mock", false, "use mock provider")
	_ = fs.Parse(args)

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		logger.Error("resolve paths", "error", err)
		os.Exit(1)
	}
	catalog, _, err := bootstrapRuntime(paths, *mock, logger)
	if err != nil {
		logger.Error("bootstrap", "error", err)
		os.Exit(1)
	}

	settings, err := config.LoadSettings(paths.home)
	if err != nil {
		logger.Error("load settings", "error", err)
		os.Exit(1)
	}
	name := *agentName
	if name == "" {
		name = settings.DefaultAgent
	}

	state, err := newChatState(catalog, *mock, paths, name)
	if err != nil {
		logger.Error("init chat", "error", err)
		os.Exit(1)
	}

	tui.PrintWelcome(state.agent.Name, state.agent.Provider, state.agent.Model)

	rl, err := newChatReadline(paths.home)
	if err != nil {
		logger.Error("readline", "error", err)
		os.Exit(1)
	}
	defer rl.Close()

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

		// Create policy from agent permissions.
		var pol permission.Policy
		if state.agent.Permissions != nil {
			pol = permission.NewAgentPolicy(*state.agent.Permissions)
		} else {
			pol = permission.AllowAllPolicy{}
		}

		// Cancel loop on SIGINT (Ctrl+C).
		ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)

		events, err := loop.Run(ctx, loop.Config{
			Provider: state.provider,
			Registry: state.reg,
			Agent:    state.agent,
			Session:  state.sess,
			Prompt:   line,
			Store:    state.store,
			Policy:   pol,
			Approver: CLIApprover{},
		})
		stop() // release signal handler so readline can catch Ctrl+C again
		if err != nil {
			fmt.Println(tui.Error(err.Error()))
			continue
		}
		tui.PrintEvents(events)
	}
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
	a, err := agent.LoadByName(paths.agentsDir, httpapi.NormalizeAgentName(agentName))
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

func handleChatCommand(line string, state *chatState) (exit bool) {
	parts := strings.Fields(line)
	switch parts[0] {
	case "/exit", "/quit":
		fmt.Println(tui.Muted("再见"))
		return true
	case "/help":
		tui.PrintHelp()
		return false
	case "/clear":
		if state.store != nil {
			if err := state.store.Save(state.sess); err != nil {
				fmt.Println(tui.Error(fmt.Sprintf("保存会话失败: %v", err)))
			} else {
				fmt.Println(tui.Muted(fmt.Sprintf("会话 %s 已保存", state.sess.ID)))
			}
		}
		state.sess = session.New(state.agent.Name)
		fmt.Println(tui.Success("会话已清空"))
		return false
	case "/agent":
		if len(parts) < 2 {
			names, err := agent.ListAvailable(state.paths.agentsDir)
			if err != nil {
				fmt.Println(tui.Error(err.Error()))
				return false
			}
			if len(names) == 0 {
				fmt.Println(tui.Muted("没有可用的 agent"))
				return false
			}
			fmt.Println(tui.Muted("可用 agent:"))
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
		fmt.Println(tui.Success(fmt.Sprintf("已切换 %s · %s · %s", loaded.Name, loaded.Provider, loaded.Model)))
		return false
	case "/tools":
		if len(parts) >= 2 {
			a, err := agent.LoadByNameAndValidate(state.paths.agentsDir, parts[1], state.reg.Names())
			if err != nil {
				fmt.Println(tui.Error(err.Error()))
				return false
			}
			fmt.Println(tui.Success(fmt.Sprintf("%s 工具验证通过: %v", a.Name, a.Tools)))
			return false
		}
		names := state.reg.Names()
		if len(names) == 0 {
			fmt.Println(tui.Muted("没有已注册的工具"))
			return false
		}
		fmt.Println(tui.Muted(fmt.Sprintf("已注册工具 (%d):", len(names))))
		for _, t := range state.reg.List() {
			fmt.Printf("  %-16s %s\n", tui.Muted(t.Name()), t.Description())
		}
		return false
	default:
		fmt.Println(tui.Muted("未知命令，输入 /help"))
		return false
	}
}
