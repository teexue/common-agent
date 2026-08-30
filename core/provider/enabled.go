package provider

import (
	"fmt"
	"sort"
)

// EnabledModels returns the models the user selected for this provider.
// Providers saved before this field existed fall back to default_model.
func EnabledModels(e ProfileEntry) []string {
	if len(e.Models) > 0 {
		return append([]string(nil), e.Models...)
	}
	if e.DefaultModel != "" {
		return []string{e.DefaultModel}
	}
	return nil
}

// ModelEnabled reports whether model is in the provider's enabled set.
func ModelEnabled(e ProfileEntry, model string) bool {
	if model == "" {
		return false
	}
	for _, m := range EnabledModels(e) {
		if m == model {
			return true
		}
	}
	return false
}

// ProviderForModel returns a catalog provider that has model enabled.
// When several providers enable the same model, the lexicographically first
// name wins so routing is deterministic across process restarts.
func (c *Catalog) ProviderForModel(model string) (string, bool) {
	if c == nil || model == "" {
		return "", false
	}
	var names []string
	for name, entry := range c.entries {
		if ModelEnabled(entry, model) {
			names = append(names, name)
		}
	}
	if len(names) == 0 {
		return "", false
	}
	sort.Strings(names)
	return names[0], true
}

// ModelAllowed reports whether providerName may run model.
// A nil catalog skips the allow-list (tests / mock runs).
func (c *Catalog) ModelAllowed(providerName, model string) bool {
	if c == nil {
		return true
	}
	entry, ok := c.entries[providerName]
	if !ok {
		return false
	}
	return ModelEnabled(entry, model)
}

// EnabledModelInfos returns id-only listings for the provider's enabled set.
func (c *Catalog) EnabledModelInfos(name string) ([]ModelInfo, error) {
	if c == nil {
		return nil, fmt.Errorf("provider catalog is not configured")
	}
	entry, ok := c.entries[name]
	if !ok {
		return nil, fmt.Errorf("provider %q not found", name)
	}
	ids := EnabledModels(entry)
	out := make([]ModelInfo, len(ids))
	for i, id := range ids {
		out[i] = ModelInfo{ID: id, ContextWindow: entry.ModelWindows[id]}
	}
	return out, nil
}
