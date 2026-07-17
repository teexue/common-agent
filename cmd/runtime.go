package main

import (
	"fmt"
	"log/slog"

	"github.com/teexue/common-agent/core/config"
	"github.com/teexue/common-agent/core/i18n"
	"github.com/teexue/common-agent/core/provider"
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

func bootstrapRuntime(paths runtimePaths, useMock bool, logger *slog.Logger) (*provider.Catalog, *config.CredentialStore, error) {
	if useMock {
		return nil, nil, nil
	}
	if err := config.InstallDefaults(paths.home); err != nil {
		return nil, nil, err
	}

	creds, err := config.NewCredentialStore(paths.home)
	if err != nil {
		return nil, nil, fmt.Errorf("load credentials: %w (run: agent-server config init)", err)
	}

	catalog, err := provider.LoadCatalog(paths.providers, creds.Lookup)
	if err != nil {
		return nil, nil, fmt.Errorf("load providers from %s: %w (run: agent-server config init)", paths.providers, err)
	}
	logger.Debug("log.runtime.ready", "home", paths.home, "providers", paths.providers)
	return catalog, creds, nil
}

func printPaths(paths runtimePaths) {
	fmt.Println(i18n.T("cli.paths.home", "path", paths.home))
	fmt.Println(i18n.T("cli.paths.providers", "path", paths.providers))
	fmt.Println(i18n.T("cli.paths.agents", "path", paths.agentsDir))
	fmt.Println(i18n.T("cli.paths.settings", "path", config.SettingsFile(paths.home)))
	fmt.Println(i18n.T("cli.paths.credentials", "path", config.CredentialsFile(paths.home)))
}
