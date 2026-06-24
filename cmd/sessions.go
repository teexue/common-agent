package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/teexue/common-agent/core/agent"
	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/loop"
	"github.com/teexue/common-agent/core/permission"
	"github.com/teexue/common-agent/core/session"
	"github.com/teexue/common-agent/core/tui"
	httpapi "github.com/teexue/common-agent/server/http"
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
	fmt.Fprintf(os.Stderr, `Usage:
  agent-server sessions list               列出所有会话
  agent-server sessions resume --id <id>   恢复指定会话
  agent-server sessions delete --id <id>   删除指定会话

  可用 --home 覆盖默认配置目录
`)
}

func sessionsList(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("sessions list", flag.ExitOnError)
	homeFlag := fs.String("home", "", "config home")
	_ = fs.Parse(args)

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		logger.Error("resolve paths", "error", err)
		os.Exit(1)
	}

	store, err := session.NewFileStore(config.SessionsDir(paths.home))
	if err != nil {
		logger.Error("open session store", "error", err)
		os.Exit(1)
	}

	metas, err := store.List()
	if err != nil {
		logger.Error("list sessions", "error", err)
		os.Exit(1)
	}

	if len(metas) == 0 {
		fmt.Println(tui.Muted("没有已保存的会话"))
		return
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "ID\tAGENT\tUPDATED\tMESSAGES\n")
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
	sessionID := fs.String("id", "", "session ID to resume")
	homeFlag := fs.String("home", "", "config home")
	mock := fs.Bool("mock", false, "use mock provider")
	_ = fs.Parse(args)

	if *sessionID == "" {
		fmt.Fprintln(os.Stderr, "error: --id is required")
		os.Exit(1)
	}

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		logger.Error("resolve paths", "error", err)
		os.Exit(1)
	}

	store, err := session.NewFileStore(config.SessionsDir(paths.home))
	if err != nil {
		logger.Error("open session store", "error", err)
		os.Exit(1)
	}

	loaded, err := store.Load(*sessionID)
	if err != nil {
		logger.Error("load session", "error", err)
		os.Exit(1)
	}

	catalog, _, err := bootstrapRuntime(paths, *mock, logger)
	if err != nil {
		logger.Error("bootstrap", "error", err)
		os.Exit(1)
	}

	a, err := agent.LoadByName(paths.agentsDir, httpapi.NormalizeAgentName(loaded.Agent))
	if err != nil {
		logger.Error("load agent", "error", err)
		os.Exit(1)
	}

	p, err := resolveProvider(catalog, *mock)(a)
	if err != nil {
		logger.Error("create provider", "error", err)
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

	fmt.Println(tui.Success(fmt.Sprintf("已恢复会话 %s (%s)", loaded.ID, loaded.Agent)))
	msgs := loaded.GetMessages()
	fmt.Println(tui.Muted(fmt.Sprintf("历史消息: %d 条", len(msgs))))

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

		events, err := loop.Run(context.Background(), loop.Config{
			Provider: state.provider,
			Registry: state.reg,
			Agent:    state.agent,
			Session:  state.sess,
			Prompt:   line,
			Store:    store,
			Policy:   pol,
			Approver: CLIApprover{},
		})
		if err != nil {
			fmt.Println(tui.Error(err.Error()))
			continue
		}
		tui.PrintEvents(events)
	}
}

func sessionsDelete(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("sessions delete", flag.ExitOnError)
	sessionID := fs.String("id", "", "session ID to delete")
	homeFlag := fs.String("home", "", "config home")
	_ = fs.Parse(args)

	if *sessionID == "" {
		fmt.Fprintln(os.Stderr, "error: --id is required")
		os.Exit(1)
	}

	paths, err := resolvePaths(*homeFlag)
	if err != nil {
		logger.Error("resolve paths", "error", err)
		os.Exit(1)
	}

	store, err := session.NewFileStore(config.SessionsDir(paths.home))
	if err != nil {
		logger.Error("open session store", "error", err)
		os.Exit(1)
	}

	if err := store.Delete(*sessionID); err != nil {
		logger.Error("delete session", "error", err)
		os.Exit(1)
	}

	fmt.Println(tui.Success(fmt.Sprintf("会话 %s 已删除", *sessionID)))
}
