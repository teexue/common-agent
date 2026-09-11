package builtin

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrepareVisionImage_KeepsTinyOriginal(t *testing.T) {
	tiny, err := base64.StdEncoding.DecodeString(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	)
	require.NoError(t, err)
	out, media, err := prepareVisionImage(tiny, "image/png")
	require.NoError(t, err)
	assert.Equal(t, "image/png", media)
	assert.Equal(t, tiny, out)
}

func TestPrepareVisionImage_ShrinksLargePNG(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 2400, 1800))
	for y := 0; y < 1800; y++ {
		for x := 0; x < 2400; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x), G: uint8(y), B: 40, A: 255})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	raw := buf.Bytes()
	require.Greater(t, len(raw), 10*1024)

	out, media, err := prepareVisionImage(raw, "image/png")
	require.NoError(t, err)
	assert.Equal(t, "image/jpeg", media)
	assert.LessOrEqual(t, len(out), visionMaxEncoded)
	decoded, err := jpeg.Decode(bytes.NewReader(out))
	require.NoError(t, err)
	b := decoded.Bounds()
	assert.LessOrEqual(t, b.Dx(), visionMaxSide)
	assert.LessOrEqual(t, b.Dy(), visionMaxSide)
}
