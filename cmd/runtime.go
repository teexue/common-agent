package main

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/embedding"
	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/job"
	"github.com/teexue/common-agent/core/knowledge"
	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/store"
	"github.com/teexue/common-agent/tools/builtin"
	"github.com/teexue/common-agent/tools/registry"
)

type runtimePaths struct {
	home      string
	providers string
	agentsDir string
}

func defaultPaths() (runtimePaths, error) {
	home, err := config.Home(false)
	if err != nil {
		return runtimePaths{}, err
	}
	return runtimePaths{
		home:      home,
		providers: config.ProvidersFile(home),
		agentsDir: config.AgentsDir(home),
	}, nil
}

func resolvePaths(homeFlag string) (runtimePaths, error) {
	if homeFlag != "" {
		return runtimePaths{
			home:      homeFlag,
			providers: config.ProvidersFile(homeFlag),
			agentsDir: config.AgentsDir(homeFlag),
		}, nil
	}
	return defaultPaths()
}

func openStateDB(home string, logger *slog.Logger) (*store.DB, error) {
	if err := config.EnsureDirs(home); err != nil {
		return nil, err
	}
	db, err := store.Open(home)
	if err != nil {
		return nil, err
	}
	config.BindDB(db)
	logger.Debug("log.runtime.state_db", "path", store.StateFile(home))
	return db, nil
}

func bootstrapRuntime(paths runtimePaths, useMock bool, logger *slog.Logger) (*provider.Catalog, *config.CredentialStore, *store.DB, error) {
	if useMock {
		return nil, nil, nil, nil
	}
	db, err := openStateDB(paths.home, logger)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("open state.db: %w", err)
	}

	creds, err := config.NewCredentialStore(paths.home)
	if err != nil {
		_ = db.Close()
		return nil, nil, nil, fmt.Errorf("load credentials: %w (run: agent-server config init)", err)
	}

	catalog, err := db.LoadCatalog(creds.Lookup)
	if err != nil {
		if provider.IsMissingCatalogError(err) {
			logger.Warn("log.runtime.no_providers", "path", "state.db")
			return nil, creds, db, nil
		}
		_ = db.Close()
		return nil, nil, nil, fmt.Errorf("load providers: %w (run: agent-server config init)", err)
	}
	logger.Debug("log.runtime.ready", "home", paths.home)
	return catalog, creds, db, nil
}

func printPaths(paths runtimePaths) {
	fmt.Println(i18n.T("cli.paths.home", "path", paths.home))
	fmt.Println(i18n.T("cli.paths.providers", "path", paths.providers))
	fmt.Println(i18n.T("cli.paths.agents", "path", paths.agentsDir))
	fmt.Println(i18n.T("cli.paths.settings", "path", config.SettingsFile(paths.home)))
	fmt.Println(i18n.T("cli.paths.credentials", "path", config.CredentialsFile(paths.home)))
	fmt.Println("state.db:", store.StateFile(paths.home))
}

// registerRuntimeTools registers knowledge and job tools backed by the user's
// home directory, mirroring the server wiring so CLI runs (run / chat) support
// agents that reference them. Non-fatal: failures are logged and skipped.
func registerRuntimeTools(reg *registry.Registry, paths runtimePaths, settings config.Settings, creds *config.CredentialStore, logger *slog.Logger) {
	kbMgr, err := knowledge.NewManager(config.KnowledgeDir(paths.home))
	if err != nil {
		logger.Warn("log.knowledge.open", "error", err)
	} else {
		var emb embedding.Embedder
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
		builtin.RegisterKnowledge(reg, knowledge.NewRuntime(kbMgr, emb))
	}

	jobStore, err := job.NewFileStore(config.JobsDir(paths.home))
	if err != nil {
		logger.Warn("log.job.open_store", "error", err)
		return
	}
	reg.MustRegister(builtin.CreateJob{Store: jobStore})
}
