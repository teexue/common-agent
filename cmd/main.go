package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tui"
	grpcapi "github.com/teexue/common-agent/server/grpc"
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
	case "sessions":
		runSessions(os.Args[2:], logger)
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
  agent-server sessions list            列出所有会话
  agent-server sessions resume --id ID  恢复指定会话
  agent-server sessions delete --id ID  删除指定会话
  agent-server tools                    列出已注册工具

  默认配置目录: ~/.common-agent
  可用 --home 覆盖；可用 --mock 离线调试

  agent-server config --help  查看更多 config 子命令
`)
}

func runServe(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", ":8080", "HTTP listen address")
	grpcAddr := fs.String("grpc-addr", "", "gRPC listen address (empty = disabled)")
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

	var sessStore session.Store
	if !*mock {
		sessStore, err = session.NewFileStore(config.SessionsDir(paths.home))
		if err != nil {
			logger.Error("open session store", "error", err)
			os.Exit(1)
		}
	}

	// HTTP server.
	srv := httpapi.NewServer(paths.agentsDir, reg, resolveProvider(catalog, *mock), distFS(), logger, sessStore)
	httpServer := &http.Server{
		Addr:              *addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Start gRPC server if --grpc-addr is set.
	var grpcServer *grpc.Server
	if *grpcAddr != "" {
		grpcSrv := grpcapi.NewGRPCServer(paths.agentsDir, reg, resolveProvider(catalog, *mock), logger, sessStore)
		grpcServer = grpc.NewServer()
		grpcSrv.RegisterServer(grpcServer)

		lis, err := net.Listen("tcp", *grpcAddr)
		if err != nil {
			logger.Error("grpc listen", "error", err)
			os.Exit(1)
		}

		go func() {
			logger.Info("grpc server listening", "addr", *grpcAddr, "home", paths.home)
			if err := grpcServer.Serve(lis); err != nil {
				logger.Error("grpc server failed", "error", err)
				os.Exit(1)
			}
		}()
	}

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
	if grpcServer != nil {
		grpcServer.GracefulStop()
	}
	_ = httpServer.Shutdown(shutdownCtx)
}

func runCLI(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	agentName := fs.String("agent", "", "agent name (default from config)")
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
	name := *agentName
	if name == "" {
		name = settings.DefaultAgent
	}

	a, err := agent.LoadByName(paths.agentsDir, httpapi.NormalizeAgentName(name))
	if err != nil {
		logger.Error("load agent", "error", err)
		os.Exit(1)
	}

	p, err := resolveProvider(catalog, *mock)(a)
	if err != nil {
		logger.Error("create provider", "error", err)
		os.Exit(1)
	}

	reg := newRegistry()
	sess := session.New(a.Name)
	events, err := loop.Run(context.Background(), loop.Config{
		Provider: p,
		Registry: reg,
		Agent:    a,
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
		"agent", a.Name,
		"provider", a.Provider,
		"model", a.Model,
		"home", paths.home,
	)
	tui.PrintEvents(events)
}

func runTools(args []string, _ *slog.Logger) {
	fs := flag.NewFlagSet("tools", flag.ExitOnError)
	agentName := fs.String("agent", "", "validate tools for an agent")
	_ = fs.Parse(args)

	reg := newRegistry()

	if *agentName != "" {
		// Validate agent tools against registry.
		home, err := config.Home(false)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		a, err := agent.LoadByNameAndValidate(config.AgentsDir(home), *agentName, reg.Names())
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("agent %q tools validated OK: %v\n", a.Name, a.Tools)
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
