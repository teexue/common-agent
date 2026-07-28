package embedding_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/embedding"
)

func TestOpenAIEmbed(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/embeddings", r.URL.Path)
		assert.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
		require.NoError(t, json.NewDecoder(r.Body).Decode(&gotBody))
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{"index": 0, "embedding": []float32{0.1, 0.2, 0.3}},
				{"index": 1, "embedding": []float32{0.4, 0.5, 0.6}},
			},
		})
	}))
	defer srv.Close()

	emb, err := embedding.NewOpenAI(embedding.OpenAIConfig{
		APIKey:     "sk-test",
		BaseURL:    srv.URL,
		Model:      "text-embedding-v4",
		Dimensions: 1024,
		Client:     srv.Client(),
	})
	require.NoError(t, err)

	vecs, err := emb.Embed(context.Background(), []string{"a", "b"})
	require.NoError(t, err)
	require.Len(t, vecs, 2)
	assert.Equal(t, []float32{0.1, 0.2, 0.3}, vecs[0])
	assert.Equal(t, 3, emb.Dimensions())
	assert.Equal(t, "text-embedding-v4", gotBody["model"])
	assert.EqualValues(t, 1024, gotBody["dimensions"])
	assert.Equal(t, "float", gotBody["encoding_format"])
}

func TestOpenAIEmbedBatches(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body struct {
			Input []string `json:"input"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		assert.LessOrEqual(t, len(body.Input), 2)
		data := make([]map[string]any, len(body.Input))
		for i := range body.Input {
			data[i] = map[string]any{"index": i, "embedding": []float32{float32(i), 1}}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": data})
	}))
	defer srv.Close()

	emb, err := embedding.NewOpenAI(embedding.OpenAIConfig{
		APIKey: "sk", BaseURL: srv.URL, Model: "m", MaxBatch: 2, Client: srv.Client(),
	})
	require.NoError(t, err)
	vecs, err := emb.Embed(context.Background(), []string{"a", "b", "c"})
	require.NoError(t, err)
	require.Len(t, vecs, 3)
	assert.Equal(t, 2, calls)
}

func TestOllamaEmbedLegacy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/embed" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		assert.Equal(t, "/api/embeddings", r.URL.Path)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"embedding": []float32{1, 0, 0},
		})
	}))
	defer srv.Close()

	emb, err := embedding.NewOllama(embedding.OllamaConfig{
		BaseURL: srv.URL,
		Model:   "nomic-embed-text",
		Client:  srv.Client(),
	})
	require.NoError(t, err)

	vecs, err := emb.Embed(context.Background(), []string{"hello"})
	require.NoError(t, err)
	require.Len(t, vecs, 1)
	assert.Equal(t, []float32{1, 0, 0}, vecs[0])
}

func TestMockEmbedder(t *testing.T) {
	m := &embedding.MockEmbedder{Dim: 4}
	a, err := m.Embed(context.Background(), []string{"abc"})
	require.NoError(t, err)
	b, err := m.Embed(context.Background(), []string{"abc"})
	require.NoError(t, err)
	assert.Equal(t, a[0], b[0])
	assert.Equal(t, 4, m.Dimensions())
}

func TestConfigNormalizeVendor(t *testing.T) {
	cfg := embedding.Config{Vendor: "qwen", Model: ""}.Normalize()
	assert.Equal(t, embedding.BackendOpenAI, cfg.Backend)
	assert.Equal(t, "https://dashscope.aliyuncs.com/compatible-mode/v1", cfg.BaseURL)
	assert.Equal(t, "DASHSCOPE_API_KEY", cfg.APIKeyEnv)
	assert.Equal(t, "text-embedding-v4", cfg.Model)
	assert.Equal(t, 1024, cfg.Dimensions)
	assert.Empty(t, cfg.LegacyProvider)
}

func TestConfigIgnoresLegacyProvider(t *testing.T) {
	cfg := embedding.Config{
		LegacyProvider: "moonshot",
		Vendor:         "qwen",
		Model:          "text-embedding-v3",
	}.Normalize()
	assert.Empty(t, cfg.LegacyProvider)
}

func TestNewWithLookup(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{"index": 0, "embedding": []float32{1, 0}},
			},
		})
	}))
	defer srv.Close()

	emb, err := embedding.New(embedding.Config{
		Backend:   embedding.BackendOpenAI,
		BaseURL:   srv.URL,
		APIKeyEnv: "TEST_EMB_KEY",
		Model:     "m",
	}, func(string) string { return "sk-from-lookup" })
	require.NoError(t, err)
	vecs, err := emb.Embed(context.Background(), []string{"x"})
	require.NoError(t, err)
	require.Len(t, vecs, 1)
}

func TestListVendors(t *testing.T) {
	list := embedding.ListVendors()
	require.Len(t, list, 2)
	names := map[string]bool{}
	for _, v := range list {
		names[v.Name] = true
	}
	assert.True(t, names["qwen"])
	assert.True(t, names["ollama"])
	assert.False(t, names["openai"])
	assert.False(t, names["siliconflow"])
}

func TestConfigValidate(t *testing.T) {
	assert.Error(t, embedding.Config{Backend: "openai", Model: "m"}.Normalize().Validate())
	assert.NoError(t, embedding.Config{
		Backend: "openai", Model: "m", BaseURL: "http://x", APIKeyEnv: "K",
	}.Validate())
	assert.NoError(t, embedding.Config{Backend: "ollama", Model: "m"}.Normalize().Validate())
	assert.Error(t, embedding.Config{Backend: "xyz", Model: "m"}.Validate())
}
