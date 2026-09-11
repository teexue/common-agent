package provider

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDropImagesBefore_StripsPriorTurnOnly(t *testing.T) {
	msgs := []Message{
		{Role: RoleUser, ContentParts: []ContentPart{
			{Type: "text", Text: "old"},
			{Type: "image_url", ImageURL: &ImageURL{URL: "data:image/png;base64,old"}},
		}},
		{Role: RoleUser, Content: "new turn", ContentParts: []ContentPart{
			{Type: "text", Text: "new turn"},
			{Type: "image_url", ImageURL: &ImageURL{URL: "data:image/png;base64,new"}},
		}},
		{Role: RoleUser, ContentParts: []ContentPart{
			{Type: "image_url", ImageURL: &ImageURL{URL: "data:image/png;base64,tool"}},
		}},
	}
	out := DropImagesBefore(msgs, 1)
	require.Len(t, out, 3)
	assert.Equal(t, "text", out[0].ContentParts[1].Type)
	assert.Contains(t, out[0].ContentParts[1].Text, "omitted")
	assert.Equal(t, "data:image/png;base64,new", out[1].ContentParts[1].ImageURL.URL)
	assert.Equal(t, "data:image/png;base64,tool", out[2].ContentParts[0].ImageURL.URL)
}

func TestDropImagesBefore_NoopWhenNothingPrior(t *testing.T) {
	msgs := []Message{{
		Role: RoleUser,
		ContentParts: []ContentPart{
			{Type: "image_url", ImageURL: &ImageURL{URL: "data:image/png;base64,x"}},
		},
	}}
	out := DropImagesBefore(msgs, 0)
	assert.Equal(t, msgs, out)
}
