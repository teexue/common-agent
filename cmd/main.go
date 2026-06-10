package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/scenario"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tui"
	httpapi "github.com/teexue/common-agent/server/http"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "serve":
		runServe(os.Args[2:], logger)
	case "run":
		runCLI(os.Args[2:], logger)
	case "chat":
		runChat(os.Args[2:], logger)
	case "tools":
		runTools(os.Args[2:], logger)
	case "config":
		runConfig(os.Args[2:])
	default:
		usage()
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintf(os.Stderr, `Usage:
  agent-server config init              交互式初始化 ~/.common-agent
  agent-server config set provider ...  命令行配置 provider
  agent-server config set-key ENV KEY   保存 API Key
  agent-server config show              查看当前配置

  agent-server chat                     交互式终端对话
  agent-server run --prompt "hello"     单次对话（默认终端可读输出）
  agent-server run --prompt "hello" --format json  NDJSON 事件流（便于脚本解析）
  agent-server serve                    启动 HTTP SSE 服务
  agent-server tools                    列出已注册工具

  默认配置目录: ~/.common-agent
  可用 --home 覆盖；可用 --mock 离线调试

  agent-server config --help  查看更多 config 子命令
`)
}

func runServe(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", ":8080", "listen address")
	homeFlag := fs.String("home", "", "config home (default ~/.common-agent)")
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

	reg := newRegistry()
	srv := httpapi.NewServer(paths.scenariosDir, reg, resolveProvider(catalog, *mock), distFS(), logger)

	httpServer := &http.Server{
		Addr:              *addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("http server listening", "addr", *addr, "home", paths.home)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(shutdownCtx)
}

func runCLI(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	scenarioName := fs.String("scenario", "", "scenario name (default from config)")
	prompt := fs.String("prompt", "", "user prompt")
	format := fs.String("format", "text", "output format: text (TUI) or json (NDJSON events)")
	homeFlag := fs.String("home", "", "config home")
	mock := fs.Bool("mock", false, "use mock provider")
	_ = fs.Parse(args)

	if *format != "text" && *format != "json" {
		fmt.Fprintf(os.Stderr, "error: --format must be text or json\n")
		os.Exit(1)
	}

	if *prompt == "" {
		fmt.Fprintln(os.Stderr, "error: --prompt is required")
		os.Exit(1)
	}

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

	sc, err := scenario.LoadByName(paths.scenariosDir, httpapi.NormalizeScenarioName(name))
	if err != nil {
		logger.Error("load scenario", "error", err)
		os.Exit(1)
	}

	p, err := resolveProvider(catalog, *mock)(sc)
	if err != nil {
		logger.Error("create provider", "error", err)
		os.Exit(1)
	}

	reg := newRegistry()
	sess := session.New(sc.Name)
	events, err := loop.Run(context.Background(), loop.Config{
		Provider: p,
		Registry: reg,
		Scenario: sc,
		Session:  sess,
		Prompt:   *prompt,
	})
	if err != nil {
		logger.Error("run agent", "error", err)
		os.Exit(1)
	}

	if *format == "json" {
		if err := event.StreamEvents(context.Background(), os.Stdout, events); err != nil {
			logger.Error("stream events", "error", err)
			os.Exit(1)
		}
		return
	}

	logger.Info("agent run started",
		"session_id", sess.ID,
		"scenario", sc.Name,
		"provider", sc.Provider,
		"model", sc.Model,
		"home", paths.home,
	)
	tui.PrintEvents(events)
}

func runTools(args []string, _ *slog.Logger) {
	fs := flag.NewFlagSet("tools", flag.ExitOnError)
	scenarioName := fs.String("scenario", "", "validate tools for a scenario")
	_ = fs.Parse(args)

	reg := newRegistry()

	if *scenarioName != "" {
		// Validate scenario tools against registry.
		home, err := config.Home(false)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		sc, err := scenario.LoadByNameAndValidate(config.ScenariosDir(home), *scenarioName, reg.Names())
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("scenario %q tools validated OK: %v\n", sc.Name, sc.Tools)
		return
	}

	// List all registered tools.
	names := reg.Names()
	if len(names) == 0 {
		fmt.Println("no tools registered")
		return
	}
	fmt.Printf("Registered tools (%d):\n", len(names))
	for _, t := range reg.List() {
		fmt.Printf("  %-20s %s\n", t.Name(), t.Description())
	}
}
