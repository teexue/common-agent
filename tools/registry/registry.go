package registry

import (
	"fmt"
	"sort"
	"sync"

	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/tool"
)

// Registry stores tools by name.
type Registry struct {
	mu    sync.RWMutex
	tools map[string]tool.Tool
}

// New creates an empty registry.
func New() *Registry {
	return &Registry{tools: make(map[string]tool.Tool)}
}

// Register adds a tool. Returns error if name already exists.
func (r *Registry) Register(t tool.Tool) error {
	name := t.Name()
	if name == "" {
		return fmt.Errorf("tool name is required")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.tools[name]; ok {
		return fmt.Errorf("tool %q already registered", name)
	}
	r.tools[name] = t
	return nil
}

// MustRegister registers a tool and panics on error (for wiring in main).
func (r *Registry) MustRegister(t tool.Tool) {
	if err := r.Register(t); err != nil {
		panic(err)
	}
}

// Get returns a tool by name.
func (r *Registry) Get(name string) (tool.Tool, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.tools[name]
	return t, ok
}

// Definitions returns LLM tool definitions for the given names.
func (r *Registry) Definitions(names []string) ([]provider.ToolDefinition, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	defs := make([]provider.ToolDefinition, 0, len(names))
	for _, name := range names {
		t, ok := r.tools[name]
		if !ok {
			return nil, fmt.Errorf("tool %q not found in registry", name)
		}
		defs = append(defs, provider.ToolDefinition{
			Name:        t.Name(),
			Description: t.Description(),
			Parameters:  t.InputSchema(),
		})
	}
	return defs, nil
}

// Names returns all registered tool names in sorted order.
func (r *Registry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.tools))
	for name := range r.tools {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// List returns all registered tools in sorted name order.
func (r *Registry) List() []tool.Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	tools := make([]tool.Tool, 0, len(r.tools))
	for _, t := range r.tools {
		tools = append(tools, t)
	}
	sort.Slice(tools, func(i, j int) bool {
		return tools[i].Name() < tools[j].Name()
	})
	return tools
}

// Unregister removes a tool by name. Returns true if the tool was found and removed.
func (r *Registry) Unregister(name string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.tools[name]; !ok {
		return false
	}
	delete(r.tools, name)
	return true
}

// UnregisterBatch removes multiple tools by name. Returns the count of removed tools.
func (r *Registry) UnregisterBatch(names []string) int {
	count := 0
	for _, name := range names {
		if r.Unregister(name) {
			count++
		}
	}
	return count
}

// RegisterBatch registers multiple tools. Stops on first error.
func (r *Registry) RegisterBatch(tools []tool.Tool) error {
	for _, t := range tools {
		if err := r.Register(t); err != nil {
			return err
		}
	}
	return nil
}

// ValidateTools checks that all given tool names are registered.
// Returns an error listing missing tools if any are not found.
func (r *Registry) ValidateTools(names []string) error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var missing []string
	for _, name := range names {
		if _, ok := r.tools[name]; !ok {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("tools not found in registry: %v", missing)
	}
	return nil
}
