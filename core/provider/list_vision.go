package provider

import "strings"

type catalogModelRow struct {
	ID             string              `json:"id"`
	Context        int                 `json:"context_length,omitempty"`
	Vision         *bool               `json:"vision,omitempty"`
	SupportsVision *bool               `json:"supports_vision,omitempty"`
	Capabilities   []string            `json:"capabilities,omitempty"`
	Modalities     []string            `json:"modalities,omitempty"`
	Architecture   catalogArchitecture `json:"architecture"`
}

type catalogArchitecture struct {
	Modality        string   `json:"modality"`
	InputModalities []string `json:"input_modalities"`
}

func (r catalogModelRow) toModelInfo() ModelInfo {
	return ModelInfo{
		ID:            r.ID,
		ContextWindow: r.Context,
		Vision:        r.hasVision(),
	}
}

func (r catalogModelRow) hasVision() bool {
	if r.Vision != nil && *r.Vision {
		return true
	}
	if r.SupportsVision != nil && *r.SupportsVision {
		return true
	}
	if tokensIncludeVision(r.Capabilities) || tokensIncludeVision(r.Modalities) {
		return true
	}
	if tokensIncludeVision(r.Architecture.InputModalities) {
		return true
	}
	return strings.Contains(strings.ToLower(r.Architecture.Modality), "image")
}

func tokensIncludeVision(vals []string) bool {
	for _, v := range vals {
		s := strings.ToLower(strings.TrimSpace(v))
		if s == "vision" || s == "image" {
			return true
		}
	}
	return false
}
