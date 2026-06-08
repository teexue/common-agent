package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/scenario"
	"github.com/teexue/common-agent/core/session"
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

	fmt.Printf("common-agent 交互对话 (scenario=%s, provider=%s, model=%s)\n", state.sc.Name, state.sc.Provider, state.sc.Model)
	fmt.Println("输入消息开始对话；/help 查看命令；/exit 退出")

	in := bufio.NewReader(os.Stdin)
	for {
		fmt.Print("\n> ")
		line, err := in.ReadString('\n')
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
			fmt.Printf("[error] %v\n", err)
			continue
		}
		fmt.Println()
		event.PrintEvents(events)
	}
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
		return true
	case "/help":
		fmt.Println("命令:")
		fmt.Println("  /help              显示帮助")
		fmt.Println("  /exit, /quit       退出")
		fmt.Println("  /clear             清空当前会话")
		fmt.Println("  /scenario [NAME]   切换 scenario（无参数列出可用 scenario）")
		fmt.Println("  /tools [SCENARIO]  列出工具（可选验证 scenario 的工具）")
		return false
	case "/clear":
		state.sess.Clear()
		fmt.Println("会话已清空")
		return false
	case "/scenario":
		if len(parts) < 2 {
			// List available scenarios.
			names, err := scenario.ListAvailable(state.paths.scenariosDir)
			if err != nil {
				fmt.Printf("列出 scenario 失败: %v\n", err)
				return false
			}
			if len(names) == 0 {
				fmt.Println("没有可用的 scenario")
				return false
			}
			fmt.Println("可用 scenario:")
			for _, n := range names {
				marker := " "
				if n == state.sc.Name {
					marker = "*"
				}
				fmt.Printf("  %s %s\n", marker, n)
			}
			return false
		}
		loaded, err := scenario.LoadByName(state.paths.scenariosDir, parts[1])
		if err != nil {
			fmt.Printf("load scenario: %v\n", err)
			return false
		}
		p, err := resolveProvider(state.catalog, state.mock)(loaded)
		if err != nil {
			fmt.Printf("provider: %v\n", err)
			return false
		}
		state.sc = loaded
		state.provider = p
		state.sess = session.New(loaded.Name)
		fmt.Printf("已切换 scenario=%s (provider=%s, model=%s)\n", loaded.Name, loaded.Provider, loaded.Model)
		return false
	case "/tools":
		if len(parts) >= 2 {
			// Validate tools for a specific scenario.
			sc, err := scenario.LoadByNameAndValidate(state.paths.scenariosDir, parts[1], state.reg.Names())
			if err != nil {
				fmt.Printf("验证失败: %v\n", err)
				return false
			}
			fmt.Printf("scenario %q 工具验证通过: %v\n", sc.Name, sc.Tools)
			return false
		}
		// List all registered tools.
		names := state.reg.Names()
		if len(names) == 0 {
			fmt.Println("没有已注册的工具")
			return false
		}
		fmt.Printf("已注册工具 (%d):\n", len(names))
		for _, t := range state.reg.List() {
			fmt.Printf("  %-20s %s\n", t.Name(), t.Description())
		}
		return false
	default:
		fmt.Println("未知命令，输入 /help")
		return false
	}
}
