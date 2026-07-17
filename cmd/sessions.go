package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"
	"text/tabwriter"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/service"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tui"
)

func runSessions(args []string, logger *slog.Logger) {
	if len(args) < 1 {
		sessionsUsage()
		os.Exit(1)
	}

	switch args[0] {
	case "list":
		sessionsList(args[1:], logger)
	case "resume":
		sessionsResume(args[1:], logger)
	case "delete":
		sessionsDelete(args[1:], logger)
	default:
		sessionsUsage()
		os.Exit(1)
	}
}

func sessionsUsage() {
	fmt.Fprint(os.Stderr, i18n.T("cli.usage.sessions"))
}

func sessionsList(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("sessions list", flag.ExitOnError)
	homeFlag := fs.String("home", "", i18n.T("cli.flag.home_short"))
	_ = fs.Parse(args)

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		logger.Error("log.cmd.resolve_paths", "error", err)
		os.Exit(1)
	}

	store, err := session.NewFileStore(config.SessionsDir(paths.home))
	if err != nil {
		logger.Error("log.session.open_store", "error", err)
		os.Exit(1)
	}

	metas, err := store.List()
	if err != nil {
		logger.Error("log.session.list", "error", err)
		os.Exit(1)
	}

	if len(metas) == 0 {
		fmt.Println(tui.Muted(i18n.T("cli.sessions.none")))
		return
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, i18n.T("cli.sessions.table_header"))
	for _, m := range metas {
		fmt.Fprintf(w, "%s\t%s\t%s\t\n",
			m.ID,
			m.Agent,
			m.UpdatedAt.Format("2006-01-02 15:04:05"),
		)
	}
	w.Flush()
}

func sessionsResume(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("sessions resume", flag.ExitOnError)
	sessionID := fs.String("id", "", i18n.T("cli.flag.session_resume"))
	homeFlag := fs.String("home", "", i18n.T("cli.flag.home_short"))
	mock := fs.Bool("mock", false, i18n.T("cli.flag.mock"))
	_ = fs.Parse(args)

	if *sessionID == "" {
		fmt.Fprintln(os.Stderr, i18n.T("cli.error.id_required"))
		os.Exit(1)
	}

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		logger.Error("log.cmd.resolve_paths", "error", err)
		os.Exit(1)
	}

	store, err := session.NewFileStore(config.SessionsDir(paths.home))
	if err != nil {
		logger.Error("log.session.open_store", "error", err)
		os.Exit(1)
	}

	loaded, err := store.Load(*sessionID)
	if err != nil {
		logger.Error("log.session.load", "error", err)
		os.Exit(1)
	}

	catalog, _, err := bootstrapRuntime(paths, *mock, logger)
	if err != nil {
		logger.Error("log.cmd.bootstrap", "error", err)
		os.Exit(1)
	}

	a, err := agent.LoadByName(paths.agentsDir, service.NormalizeAgentName(loaded.Agent))
	if err != nil {
		logger.Error("log.agent.load", "error", err)
		os.Exit(1)
	}

	p, err := resolveProvider(catalog, *mock)(a)
	if err != nil {
		logger.Error("log.provider.create", "error", err)
		os.Exit(1)
	}

	state := &chatState{
		catalog:  catalog,
		mock:     *mock,
		paths:    paths,
		agent:    a,
		provider: p,
		sess:     loaded,
		reg:      newRegistry(""), // uses current working directory
	}

	fmt.Println(tui.Success(i18n.T("cli.sessions.resumed", "id", loaded.ID, "agent", loaded.Agent)))
	msgs := loaded.GetMessages()
	fmt.Println(tui.Muted(i18n.T("cli.sessions.message_count", "count", len(msgs))))

	rl, err := newChatReadline(paths.home)
	if err != nil {
		logger.Error("log.chat.readline", "error", err)
		os.Exit(1)
	}
	defer rl.Close()

	runChatLoop(rl, state)
}

func sessionsDelete(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("sessions delete", flag.ExitOnError)
	sessionID := fs.String("id", "", i18n.T("cli.flag.session_delete"))
	homeFlag := fs.String("home", "", i18n.T("cli.flag.home_short"))
	_ = fs.Parse(args)

	if *sessionID == "" {
		fmt.Fprintln(os.Stderr, i18n.T("cli.error.id_required"))
		os.Exit(1)
	}

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		logger.Error("log.cmd.resolve_paths", "error", err)
		os.Exit(1)
	}

	store, err := session.NewFileStore(config.SessionsDir(paths.home))
	if err != nil {
		logger.Error("log.session.open_store", "error", err)
		os.Exit(1)
	}

	if err := store.Delete(*sessionID); err != nil {
		logger.Error("log.session.delete", "error", err)
		os.Exit(1)
	}

	fmt.Println(tui.Success(i18n.T("cli.sessions.deleted", "id", *sessionID)))
}
