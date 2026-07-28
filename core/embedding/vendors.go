package embedding

// Vendor is a built-in embedding provider preset.
type Vendor struct {
	Name              string
	DisplayName       string
	Backend           string // openai | ollama
	BaseURL           string
	APIKeyEnv         string
	DefaultModel      string
	Models            []string // suggested models for Settings UI
	DefaultDimensions int      // 0 = omit dimensions param
	Dimensions        []int    // allowed dimensions for Settings UI
	MaxBatch          int      // max texts per OpenAI-compatible request; 0 = unlimited
}

// VendorInfo is the JSON DTO for GET /v1/embedding/vendors.
type VendorInfo struct {
	Name              string   `json:"name"`
	DisplayName       string   `json:"display_name"`
	Backend           string   `json:"backend"`
	BaseURL           string   `json:"base_url"`
	APIKeyEnv         string   `json:"api_key_env,omitempty"`
	DefaultModel      string   `json:"default_model"`
	Models            []string `json:"models,omitempty"`
	DefaultDimensions int      `json:"default_dimensions,omitempty"`
	Dimensions        []int    `json:"dimensions,omitempty"`
	MaxBatch          int      `json:"max_batch,omitempty"`
}

// Built-in embedding vendors (chat-only providers like DeepSeek/Kimi are excluded).
var vendors = []Vendor{
	{
		Name:         "qwen",
		DisplayName:  "千问 (DashScope)",
		Backend:      BackendOpenAI,
		BaseURL:      "https://dashscope.aliyuncs.com/compatible-mode/v1",
		APIKeyEnv:    "DASHSCOPE_API_KEY",
		DefaultModel: "text-embedding-v4",
		Models: []string{
			"text-embedding-v4",
			"text-embedding-v3",
			"qwen3.7-text-embedding",
			"text-embedding-v2",
			"text-embedding-v1",
		},
		DefaultDimensions: 1024,
		// DashScope OpenAI-compatible dimensions (union across models; UI may filter).
		Dimensions: []int{2560, 2048, 1536, 1024, 768, 512, 256, 128, 64},
		MaxBatch:   10, // text-embedding-v3/v4 batch limit
	},
	{
		Name:         "ollama",
		DisplayName:  "Ollama",
		Backend:      BackendOllama,
		BaseURL:      "http://127.0.0.1:11434",
		DefaultModel: "nomic-embed-text",
		Models:       []string{"nomic-embed-text", "mxbai-embed-large", "bge-m3"},
	},
}

// LookupVendor returns a built-in embedding vendor by name.
func LookupVendor(name string) (Vendor, bool) {
	for _, v := range vendors {
		if v.Name == name {
			return v, true
		}
	}
	return Vendor{}, false
}

// ListVendors returns all built-in embedding vendor presets.
func ListVendors() []VendorInfo {
	out := make([]VendorInfo, 0, len(vendors))
	for _, v := range vendors {
		out = append(out, VendorInfo{
			Name:              v.Name,
			DisplayName:       v.DisplayName,
			Backend:           v.Backend,
			BaseURL:           v.BaseURL,
			APIKeyEnv:         v.APIKeyEnv,
			DefaultModel:      v.DefaultModel,
			Models:            append([]string(nil), v.Models...),
			DefaultDimensions: v.DefaultDimensions,
			Dimensions:        append([]int(nil), v.Dimensions...),
			MaxBatch:          v.MaxBatch,
		})
	}
	return out
}
