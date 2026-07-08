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
	"path/filepath"
	"syscall"
	"time"

	"google.golang.org/grpc"

	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/telemetry"
	"github.com/teexue/common-agent/core/tui"
	grpcapi "github.com/teexue/common-agent/server/grpc"
	httpapi "github.com/teexue/common-agent/server/http"
	"github.com/teexue/common-agent/tools/registry"
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
	case "templates":
		runTemplates(os.Args[2:])
	case "validate":
		runValidate(os.Args[2:])
	case "skills":
		runSkills(os.Args[2:])
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

	reg := newRegistry("") // uses current working directory

	var sessStore session.Store
	if !*mock {
		sessStore, err = session.NewFileStore(config.SessionsDir(paths.home))
		if err != nil {
			logger.Error("open session store", "error", err)
			os.Exit(1)
		}
	}

	// Event logger for session replay.
	eventLogger := audit.NewEventLogger(filepath.Join(paths.home, "events"))

	// HTTP server.
	srv := httpapi.NewServer(httpapi.ServerConfig{AgentsDir: paths.agentsDir, Registry: reg, NewProvider: resolveProvider(catalog, *mock), StaticFS: distFS(), Logger: logger, Store: sessStore})
	srv.SetEventLogger(eventLogger)
	if catalog != nil {
		srv.SetCatalog(catalog)
	}
	srv.StartWatcher()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	srv.SetShutdownCtx(ctx)

	httpServer := &http.Server{
		Addr:              *addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Start gRPC server if --grpc-addr is set.
	var grpcServer *grpc.Server
	if *grpcAddr != "" {
		grpcServer = startGRPCServer(GRPCConfig{Addr: *grpcAddr, Paths: paths, Reg: reg, Catalog: catalog, Mock: *mock, Logger: logger, SessStore: sessStore, Health: srv.Health()})
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

// GRPCConfig holds configuration for starting a gRPC server.
type GRPCConfig struct {
	Addr      string
	Paths     runtimePaths
	Reg       *registry.Registry
	Catalog   *provider.Catalog
	Mock      bool
	Logger    *slog.Logger
	SessStore session.Store
	Health    *telemetry.HealthServer
}

// startGRPCServer creates, registers, and starts a gRPC server in a goroutine.
func startGRPCServer(cfg GRPCConfig) *grpc.Server {
	grpcSrv := grpcapi.NewGRPCServer(cfg.Paths.agentsDir, cfg.Reg, resolveProvider(cfg.Catalog, cfg.Mock), cfg.Logger, cfg.SessStore)
	if cfg.Health != nil {
		grpcSrv.SetHealth(cfg.Health)
	}
	srv := grpc.NewServer()
	grpcSrv.RegisterServer(srv)

	lis, err := net.Listen("tcp", cfg.Addr)
	if err != nil {
		cfg.Logger.Error("grpc listen", "error", err)
		os.Exit(1)
	}

	go func() {
		cfg.Logger.Info("grpc server listening", "addr", cfg.Addr, "home", cfg.Paths.home)
		if err := srv.Serve(lis); err != nil {
			cfg.Logger.Error("grpc server failed", "error", err)
			os.Exit(1)
		}
	}()
	return srv
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

	a, err := agent.LoadByName(paths.agentsDir, service.NormalizeAgentName(name))
	if err != nil {
		logger.Error("load agent", "error", err)
		os.Exit(1)
	}

	p, err := resolveProvider(catalog, *mock)(a)
	if err != nil {
		logger.Error("create provider", "error", err)
		os.Exit(1)
	}

	reg := newRegistry("") // uses current working directory
	sess := session.New(a.Name)
	events, err := loop.Run(context.Background(), loop.Config{
		Provider: p, Registry: reg, Agent: a, Session: sess, Prompt: *prompt,
	})
	if err != nil {
		logger.Error("run agent", "error", err)
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
			cfg.Logger.Error("stream events", "error", err)
			os.Exit(1)
		}
		return
	}
	cfg.Logger.Info("agent run started", "session_id", cfg.Session.ID, "agent", cfg.Agent.Name, "provider", cfg.Agent.Provider, "model", cfg.Agent.Model, "home", cfg.Paths.home)
	tui.PrintEvents(cfg.Events)
}

func runTools(args []string, _ *slog.Logger) {
	fs := flag.NewFlagSet("tools", flag.ExitOnError)
	agentName := fs.String("agent", "", "validate tools for an agent")
	_ = fs.Parse(args)

	home, err := config.Home(false)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	reg := newRegistry("") // uses current working directory

	if *agentName != "" {
		// Validate agent tools against registry.
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
