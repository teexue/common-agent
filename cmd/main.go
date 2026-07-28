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

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/audit"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/embedding"
	"github.com/teexue/common-agent/core/event"
	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/job"
	"github.com/teexue/common-agent/core/knowledge"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/store"
	"github.com/teexue/common-agent/core/telemetry"
	"github.com/teexue/common-agent/core/tui"
	grpcapi "github.com/teexue/common-agent/server/grpc"
	httpapi "github.com/teexue/common-agent/server/http"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
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

func runServe(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", ":8080", i18n.T("cli.flag.addr"))
	grpcAddr := fs.String("grpc-addr", "", i18n.T("cli.flag.grpc_addr"))
	homeFlag := fs.String("home", "", i18n.T("cli.flag.home"))
	localeFlag := fs.String("locale", "", i18n.T("cli.flag.locale"))
	mock := fs.Bool("mock", false, i18n.T("cli.flag.mock"))
	var apiKeys stringList
	fs.Var(&apiKeys, "api-key", i18n.T("cli.flag.api_key"))
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
	logger = newLocaleLogger(*localeFlag, settings.Locale)

	reg := newRegistry("") // uses current working directory

	var kbMgr *knowledge.Manager
	var kbRT *knowledge.Runtime
	var emb embedding.Embedder
	if !*mock {
		var err error
		kbMgr, err = knowledge.NewManager(config.KnowledgeDir(paths.home))
		if err != nil {
			logger.Error("log.knowledge.open", "error", err)
			os.Exit(1)
		}
		if settings.Embedding != nil {
			lookup := func(k string) string { return os.Getenv(k) }
			if creds != nil {
				lookup = creds.Lookup
			}
			emb, err = embedding.New(*settings.Embedding, lookup)
			if err != nil {
				logger.Warn("log.embedding.init_failed", "error", err)
			}
		}
		kbRT = knowledge.NewRuntime(kbMgr, emb)
		builtin.RegisterKnowledge(reg, kbRT)
	}

	var sessStore session.Store
	if stateDB != nil {
		sessStore = store.NewSessionStore(stateDB)
	}

	var jobStore job.Store
	if !*mock {
		jobStore, err = job.NewFileStore(config.JobsDir(paths.home))
		if err != nil {
			logger.Error("log.job.open_store", "error", err)
			os.Exit(1)
		}
	}
	if jobStore != nil {
		reg.MustRegister(builtin.CreateJob{Store: jobStore})
	}

	// Event logger for session replay.
	eventLogger := audit.NewEventLogger(filepath.Join(paths.home, "events"))

	// HTTP server.
	srv := httpapi.NewServer(httpapi.ServerConfig{
		AgentsDir:   paths.agentsDir,
		HomeDir:     paths.home,
		Registry:    reg,
		NewProvider: resolveProvider(catalog, *mock),
		StaticFS:    distFS(),
		Logger:      logger,
		Store:       sessStore,
		Jobs:        jobStore,
		Knowledge:   kbMgr,
		Ingester:    nil,
		Retriever:   nil,
		Embedder:    emb,
		KnowledgeRuntime: kbRT,
	})
	if kbRT != nil {
		srv.Service().Ingester = kbRT.CurrentIngester()
		srv.Service().Retriever = kbRT.CurrentRetriever()
	}
	srv.SetEventLogger(eventLogger)
	if catalog != nil {
		srv.SetCatalog(catalog)
	}
	if creds != nil {
		srv.SetCredentialStore(creds)
	}
	if stateDB != nil {
		if err := srv.SetStateDB(stateDB); err != nil {
			logger.Error("log.config.load_api_keys", "error", err)
			os.Exit(1)
		}
	}
	if len(apiKeys) > 0 {
		srv.SetAPIKeys([]string(apiKeys))
	}
	srv.StartWatcher()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	srv.SetShutdownCtx(ctx)

	var sched *job.Scheduler
	if jobStore != nil {
		sched = job.NewScheduler(job.SchedulerConfig{
			Store:       jobStore,
			Runner:      srv.Service().JobRunner(),
			Logger:      logger,
			TickEvery:   time.Second,
			MaxParallel: 2,
		})
		srv.SetScheduler(sched)
		sched.Start(ctx)
		defer sched.Stop()
	}

	httpServer := &http.Server{
		Addr:              *addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Start gRPC server if --grpc-addr is set.
	var grpcServer *grpc.Server
	if *grpcAddr != "" {
		grpcServer = startGRPCServer(GRPCConfig{
			Addr: *grpcAddr, Paths: paths, Reg: reg, Catalog: catalog, Mock: *mock,
			Logger: logger, SessStore: sessStore, Health: srv.Health(), APIKeys: []string(apiKeys),
		})
	}

	go func() {
		logger.Info("log.http.listening", "addr", *addr, "home", paths.home)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("log.http.server_failed", "error", err)
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
	APIKeys   []string
}

// startGRPCServer creates, registers, and starts a gRPC server in a goroutine.
func startGRPCServer(cfg GRPCConfig) *grpc.Server {
	grpcSrv := grpcapi.NewGRPCServer(cfg.Paths.agentsDir, cfg.Reg, resolveProvider(cfg.Catalog, cfg.Mock), cfg.Logger, cfg.SessStore)
	if cfg.Health != nil {
		grpcSrv.SetHealth(cfg.Health)
	}
	if len(cfg.APIKeys) > 0 {
		grpcSrv.SetAPIKeys(cfg.APIKeys)
	}
	srv := grpc.NewServer()
	grpcSrv.RegisterServer(srv)

	lis, err := net.Listen("tcp", cfg.Addr)
	if err != nil {
		cfg.Logger.Error("log.grpc.listen_failed", "error", err)
		os.Exit(1)
	}

	go func() {
		cfg.Logger.Info("log.grpc.listening", "addr", cfg.Addr, "home", cfg.Paths.home)
		if err := srv.Serve(lis); err != nil {
			cfg.Logger.Error("log.grpc.server_failed", "error", err)
			os.Exit(1)
		}
	}()
	return srv
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

	// In-pipeline prompt optimization (agent-driven, non-fatal).
	service.OptimizeSystemPrompt(context.Background(), nil, a, p, logger)
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
