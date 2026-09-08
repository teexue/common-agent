package loop

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
)

func TestRecordToolResults_AttachesImageAsUserParts(t *testing.T) {
	sess := session.New("demo")
	cfg := Config{Session: sess}
	out, _ := json.Marshal(map[string]any{"path": "a.png", "bytes": 10})
	recordToolResults(cfg, []pendingResult{{
		callID: "c1", toolName: "read_image", output: out,
		parts: []provider.ContentPart{{
			Type: "image_url",
			ImageURL: &provider.ImageURL{
				URL: "data:image/png;base64,xx", Detail: "auto",
			},
		}},
	}}, 0)

	msgs := sess.GetMessages()
	require.Len(t, msgs, 2)
	assert.Equal(t, provider.RoleTool, msgs[0].Role)
	assert.Equal(t, "c1", msgs[0].ToolCallID)
	assert.Contains(t, msgs[0].Content, "a.png")

	assert.Equal(t, provider.RoleUser, msgs[1].Role)
	assert.True(t, provider.IsToolImageUserMessage(msgs[1]))
	require.GreaterOrEqual(t, len(msgs[1].ContentParts), 2)
	assert.Equal(t, "text", msgs[1].ContentParts[0].Type)
	assert.Equal(t, "image_url", msgs[1].ContentParts[1].Type)
	require.NotNil(t, msgs[1].ContentParts[1].ImageURL)
	assert.Equal(t, "data:image/png;base64,xx", msgs[1].ContentParts[1].ImageURL.URL)
}

func TestImageContentParts_FiltersNonImages(t *testing.T) {
	parts := imageContentParts([]provider.ContentPart{
		{Type: "text", Text: "x"},
		{Type: "image_url", ImageURL: &provider.ImageURL{URL: "data:image/png;base64,a"}},
		{Type: "image_url"},
	})
	require.Len(t, parts, 1)
	assert.Equal(t, "data:image/png;base64,a", parts[0].ImageURL.URL)
}
