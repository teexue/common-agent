package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/chzyer/readline"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/scenario"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tui"
	httpapi "github.com/teexue/common-agent/server/http"
	"github.com/teexue/common-agent/tools/registry"
)

type chatState struct {
	catalog  *provider.Catalog
	mock     bool
	paths    runtimePaths
	sc       *scenario.Scenario
	provider provider.Provider
	sess     *session.Session
	reg      *registry.Registry
}

func runChat(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("chat", flag.ExitOnError)
	scenarioName := fs.String("scenario", "", "scenario name (default from config)")
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
	name := *scenarioName
	if name == "" {
		name = settings.DefaultScenario
	}

	state, err := newChatState(catalog, *mock, paths, name)
	if err != nil {
		logger.Error("init chat", "error", err)
		os.Exit(1)
	}

	tui.PrintWelcome(state.sc.Name, state.sc.Provider, state.sc.Model)

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

		events, err := loop.Run(context.Background(), loop.Config{
			Provider: state.provider,
			Registry: state.reg,
			Scenario: state.sc,
			Session:  state.sess,
			Prompt:   line,
		})
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

func newChatState(catalog *provider.Catalog, mock bool, paths runtimePaths, scenarioName string) (*chatState, error) {
	sc, err := scenario.LoadByName(paths.scenariosDir, httpapi.NormalizeScenarioName(scenarioName))
	if err != nil {
		return nil, err
	}
	p, err := resolveProvider(catalog, mock)(sc)
	if err != nil {
		return nil, err
	}
	return &chatState{
		catalog:  catalog,
		mock:     mock,
		paths:    paths,
		sc:       sc,
		provider: p,
		sess:     session.New(sc.Name),
		reg:      newRegistry(),
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
		state.sess.Clear()
		fmt.Println(tui.Success("会话已清空"))
		return false
	case "/scenario":
		if len(parts) < 2 {
			names, err := scenario.ListAvailable(state.paths.scenariosDir)
			if err != nil {
				fmt.Println(tui.Error(err.Error()))
				return false
			}
			if len(names) == 0 {
				fmt.Println(tui.Muted("没有可用的 scenario"))
				return false
			}
			fmt.Println(tui.Muted("可用 scenario:"))
			for _, n := range names {
				marker := " "
				if n == state.sc.Name {
					marker = tui.Success("●")
				}
				fmt.Printf("  %s %s\n", marker, n)
			}
			return false
		}
		loaded, err := scenario.LoadByName(state.paths.scenariosDir, parts[1])
		if err != nil {
			fmt.Println(tui.Error(err.Error()))
			return false
		}
		p, err := resolveProvider(state.catalog, state.mock)(loaded)
		if err != nil {
			fmt.Println(tui.Error(err.Error()))
			return false
		}
		state.sc = loaded
		state.provider = p
		state.sess = session.New(loaded.Name)
		fmt.Println(tui.Success(fmt.Sprintf("已切换 %s · %s · %s", loaded.Name, loaded.Provider, loaded.Model)))
		return false
	case "/tools":
		if len(parts) >= 2 {
			sc, err := scenario.LoadByNameAndValidate(state.paths.scenariosDir, parts[1], state.reg.Names())
			if err != nil {
				fmt.Println(tui.Error(err.Error()))
				return false
			}
			fmt.Println(tui.Success(fmt.Sprintf("%s 工具验证通过: %v", sc.Name, sc.Tools)))
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
