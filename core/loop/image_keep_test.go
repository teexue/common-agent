package loop

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/teexue/common-agent/core/provider"
	"github.com/teexue/common-agent/core/session"
)

func TestImageKeepFromAfterSeed_IncludesNewUserTurn(t *testing.T) {
	sess := session.New("a")
	sess.SetMessages([]provider.Message{
		{Role: provider.RoleSystem, Content: "sys"},
		{Role: provider.RoleUser, Content: "old", ContentParts: []provider.ContentPart{
			{Type: "image_url", ImageURL: &provider.ImageURL{URL: "data:old"}},
		}},
	})
	cfg := Config{Session: sess, Prompt: "new question"}
	seedMessages(cfg)
	got := imageKeepFromAfterSeed(cfg)
	assert.Equal(t, 2, got) // system, old user, new user → keep from new user
	assert.Equal(t, 3, len(sess.GetMessages()))
}

func TestImageKeepFromAfterSeed_NoPromptKeepsOnlyFuture(t *testing.T) {
	sess := session.New("a")
	sess.SetMessages([]provider.Message{
		{Role: provider.RoleUser, Content: "hi"},
	})
	cfg := Config{Session: sess}
	assert.Equal(t, 1, imageKeepFromAfterSeed(cfg))
}
