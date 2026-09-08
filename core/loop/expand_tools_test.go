package loop

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExpandImpliedTools(t *testing.T) {
	assert.Equal(t, []string{"get_time"}, ExpandImpliedTools([]string{"get_time"}))
	assert.Equal(t,
		[]string{"read_file", "read_image"},
		ExpandImpliedTools([]string{"read_file"}),
	)
	assert.Equal(t,
		[]string{"read_file", "read_image"},
		ExpandImpliedTools([]string{"read_file", "read_image"}),
	)
	assert.Equal(t, []string{"read_image"}, ExpandImpliedTools([]string{"read_image"}))
}
