package provider

// APIStyleOpenAIModelsPath is the default model-list path for OpenAI-style vendors.
const APIStyleOpenAIModelsPath = "/models"

// APIStyleAnthropicModelsPath is the default model-list path for Anthropic-style vendors.
const APIStyleAnthropicModelsPath = "/v1/models"

// DefaultModelsPathFor returns the default model-list path for an API style.
func DefaultModelsPathFor(style APIStyle) string {
	switch style {
	case StyleAnthropic:
		return APIStyleAnthropicModelsPath
	default:
		return APIStyleOpenAIModelsPath
	}
}

// Vendor is a built-in provider preset with sensible defaults.
// Dual-protocol vendors set both OpenAIBaseURL and AnthropicBaseURL; the
// chosen APIStyle selects which endpoint to use at runtime.
type Vendor struct {
	Name         string
	DisplayName  string
	DefaultModel string
	APIKeyEnv    string
	APIVersion   string // Anthropic-style api version, if applicable

	APIStyle        APIStyle   // default protocol family
	SupportedStyles []APIStyle // protocols the vendor speaks; len>=1

	OpenAIBaseURL    string    // base URL for the OpenAI-compatible endpoint
	AnthropicBaseURL  string    // base URL for the Anthropic-compatible endpoint; "" => none
	AnthropicAuth     AuthStyle // auth header for the Anthropic endpoint; default x-api-key

	Vision          bool
	SupportsThinking bool
}

// BaseURLFor returns the API base URL for the given protocol family.
func (v Vendor) BaseURLFor(style APIStyle) string {
	if style == StyleAnthropic && v.AnthropicBaseURL != "" {
		return v.AnthropicBaseURL
	}
	return v.OpenAIBaseURL
}

// AuthForStyle returns the wire auth style for the given protocol family.
func (v Vendor) AuthForStyle(style APIStyle) AuthStyle {
	if style == StyleAnthropic && v.AnthropicAuth != "" {
		return v.AnthropicAuth
	}
	return AuthBearer
}

// SupportsStyle reports whether the vendor speaks the given protocol family.
func (v Vendor) SupportsStyle(style APIStyle) bool {
	for _, s := range v.SupportedStyles {
		if s == style {
			return true
		}
	}
	return false
}

// builtInVendors is the curated registry of common providers.
var builtInVendors = []Vendor{
	{
		Name: "moonshot", DisplayName: "Moonshot (Kimi)",
		DefaultModel: "kimi-k2.6", APIKeyEnv: "MOONSHOT_API_KEY",
		APIStyle: StyleAnthropic, SupportedStyles: []APIStyle{StyleAnthropic, StyleOpenAI},
		OpenAIBaseURL:   "https://api.moonshot.cn/v1",
		AnthropicBaseURL: "https://api.moonshot.cn/anthropic",
		AnthropicAuth:   AuthBearer,
		Vision: true, SupportsThinking: true,
	},
	{
		Name: "deepseek", DisplayName: "DeepSeek",
		DefaultModel: "deepseek-chat", APIKeyEnv: "DEEPSEEK_API_KEY",
		APIStyle: StyleAnthropic, SupportedStyles: []APIStyle{StyleAnthropic, StyleOpenAI},
		OpenAIBaseURL:   "https://api.deepseek.com",
		AnthropicBaseURL: "https://api.deepseek.com/anthropic",
		AnthropicAuth:   AuthXAPIKey,
	},
	{
		Name: "zhipu", DisplayName: "Zhipu (GLM)",
		DefaultModel: "glm-4-plus", APIKeyEnv: "ZHIPU_API_KEY",
		APIStyle: StyleAnthropic, SupportedStyles: []APIStyle{StyleAnthropic, StyleOpenAI},
		OpenAIBaseURL:   "https://open.bigmodel.cn/api/paas/v4",
		AnthropicBaseURL: "https://open.bigmodel.cn/api/anthropic",
		AnthropicAuth:   AuthXAPIKey,
		Vision: true,
	},
	{
		Name: "qwen", DisplayName: "Qwen (DashScope)",
		DefaultModel: "qwen-plus", APIKeyEnv: "DASHSCOPE_API_KEY",
		APIStyle: StyleOpenAI, SupportedStyles: []APIStyle{StyleOpenAI},
		OpenAIBaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		Vision: true,
	},
	{
		Name: "groq", DisplayName: "Groq",
		DefaultModel: "llama-3.3-70b-versatile", APIKeyEnv: "GROQ_API_KEY",
		APIStyle: StyleOpenAI, SupportedStyles: []APIStyle{StyleOpenAI},
		OpenAIBaseURL: "https://api.groq.com/openai/v1",
	},
	{
		Name: "siliconflow", DisplayName: "SiliconFlow",
		DefaultModel: "Qwen/Qwen2.5-72B-Instruct", APIKeyEnv: "SILICONFLOW_API_KEY",
		APIStyle: StyleOpenAI, SupportedStyles: []APIStyle{StyleOpenAI},
		OpenAIBaseURL: "https://api.siliconflow.cn/v1",
	},
	{
		Name: "openrouter", DisplayName: "OpenRouter",
		DefaultModel: "openai/gpt-4o-mini", APIKeyEnv: "OPENROUTER_API_KEY",
		APIStyle: StyleOpenAI, SupportedStyles: []APIStyle{StyleOpenAI},
		OpenAIBaseURL: "https://openrouter.ai/api/v1",
	},
	{
		Name: "ollama", DisplayName: "Ollama (local)",
		DefaultModel: "llama3.1", APIKeyEnv: "OLLAMA_API_KEY",
		APIStyle: StyleOpenAI, SupportedStyles: []APIStyle{StyleOpenAI},
		OpenAIBaseURL: "http://localhost:11434/v1",
		Vision: true,
	},
	{
		Name: "openai", DisplayName: "OpenAI",
		DefaultModel: "gpt-4o-mini", APIKeyEnv: "OPENAI_API_KEY",
		APIStyle: StyleOpenAI, SupportedStyles: []APIStyle{StyleOpenAI},
		OpenAIBaseURL: "https://api.openai.com/v1",
		Vision: true,
	},
	{
		Name: "anthropic", DisplayName: "Anthropic",
		DefaultModel: "claude-sonnet-4-20250514", APIKeyEnv: "ANTHROPIC_API_KEY",
		APIVersion: "2023-06-01",
		APIStyle: StyleAnthropic, SupportedStyles: []APIStyle{StyleAnthropic},
		AnthropicBaseURL: "https://api.anthropic.com",
		AnthropicAuth:   AuthXAPIKey,
		Vision: true,
	},
}

// BuiltInVendors returns the curated vendor presets.
func BuiltInVendors() []Vendor { return builtInVendors }

// LookupVendor returns a built-in vendor by name.
func LookupVendor(name string) (Vendor, bool) {
	for _, v := range builtInVendors {
		if v.Name == name {
			return v, true
		}
	}
	return Vendor{}, false
}

// VendorInfo is a secret-free summary of a built-in vendor, for API listing.
type VendorInfo struct {
	Name             string    `json:"name"`
	DisplayName      string    `json:"display_name"`
	DefaultModel     string    `json:"default_model"`
	APIKeyEnv        string    `json:"api_key_env"`
	APIVersion       string    `json:"api_version,omitempty"`
	APIStyle         APIStyle  `json:"api_style"`
	SupportedStyles  []APIStyle `json:"supported_styles"`
	OpenAIBaseURL    string    `json:"openai_base_url"`
	AnthropicBaseURL string    `json:"anthropic_base_url,omitempty"`
	AnthropicAuth    AuthStyle `json:"anthropic_auth,omitempty"`
	Vision           bool      `json:"vision"`
	SupportsThinking bool     `json:"supports_thinking"`
}

// VendorInfos returns secret-free summaries of all built-in vendors.
func VendorInfos() []VendorInfo {
	out := make([]VendorInfo, 0, len(builtInVendors))
	for _, v := range builtInVendors {
		styles := v.SupportedStyles
		if len(styles) == 0 {
			styles = []APIStyle{v.APIStyle}
		}
		auth := v.AnthropicAuth
		if auth == "" && v.AnthropicBaseURL != "" {
			auth = AuthXAPIKey
		}
		out = append(out, VendorInfo{
			Name: v.Name, DisplayName: v.DisplayName, DefaultModel: v.DefaultModel,
			APIKeyEnv: v.APIKeyEnv, APIVersion: v.APIVersion,
			APIStyle: v.APIStyle, SupportedStyles: styles,
			OpenAIBaseURL: v.OpenAIBaseURL, AnthropicBaseURL: v.AnthropicBaseURL,
			AnthropicAuth: auth, Vision: v.Vision, SupportsThinking: v.SupportsThinking,
		})
	}
	return out
}
