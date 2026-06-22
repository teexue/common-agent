package agent

import (
	"log/slog"
	"path/filepath"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// ChangeType identifies what kind of file change occurred.
type ChangeType string

const (
	ChangeCreated ChangeType = "created"
	ChangeUpdated ChangeType = "updated"
	ChangeDeleted ChangeType = "deleted"
)

// AgentChange describes a change to an agent YAML file.
type AgentChange struct {
	Name string     // agent name (filename without .yaml)
	Type ChangeType // created, updated, deleted
	Path string     // full file path
}

// ChangeHandler is called when an agent file changes.
type Handler func(change AgentChange)

// Watcher monitors the agents directory for file changes.
type Watcher struct {
	dir     string
	logger  *slog.Logger
	handler Handler

	mu      sync.Mutex
	watcher *fsnotify.Watcher
	done    chan struct{}
}

// NewWatcher creates a file watcher for the agents directory.
func NewWatcher(dir string, logger *slog.Logger, handler Handler) *Watcher {
	if logger == nil {
		logger = slog.Default()
	}
	return &Watcher{
		dir:     dir,
		logger:  logger,
		handler: handler,
		done:    make(chan struct{}),
	}
}

// Start begins watching the agents directory for changes.
func (w *Watcher) Start() error {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	if err := fw.Add(w.dir); err != nil {
		fw.Close()
		return err
	}

	w.mu.Lock()
	w.watcher = fw
	w.mu.Unlock()

	go w.loop()
	w.logger.Info("agent watcher started", "dir", w.dir)
	return nil
}

// Stop stops the watcher.
func (w *Watcher) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()

	select {
	case <-w.done:
		return // already stopped
	default:
		close(w.done)
	}

	if w.watcher != nil {
		w.watcher.Close()
		w.watcher = nil
	}
	w.logger.Info("agent watcher stopped")
}

func (w *Watcher) loop() {
	for {
		select {
		case <-w.done:
			return
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			w.handleEvent(event)
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			w.logger.Error("agent watcher error", "error", err)
		}
	}
}

func (w *Watcher) handleEvent(event fsnotify.Event) {
	// Only care about .yaml files.
	name := filepath.Base(event.Name)
	if !strings.HasSuffix(name, ".yaml") {
		return
	}

	agentName := strings.TrimSuffix(name, ".yaml")

	var changeType ChangeType
	switch {
	case event.Op&(fsnotify.Create|fsnotify.Write) != 0:
		// Distinguish create vs update by checking if the file was just created.
		if event.Op&fsnotify.Create != 0 {
			changeType = ChangeCreated
		} else {
			changeType = ChangeUpdated
		}
	case event.Op&fsnotify.Remove != 0:
		changeType = ChangeDeleted
	case event.Op&fsnotify.Rename != 0:
		changeType = ChangeDeleted
	default:
		return
	}

	change := AgentChange{
		Name: agentName,
		Type: changeType,
		Path: event.Name,
	}

	w.logger.Debug("agent file changed", "name", agentName, "type", changeType, "op", event.Op.String())

	if w.handler != nil {
		w.handler(change)
	}
}
