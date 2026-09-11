package builtin

import (
	"bytes"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"math"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// Vision payloads are base64'd into every subsequent LLM request; keep each
// image small so a handful of reads cannot trip gateway 413 body limits.
const (
	visionMaxSide    = 1568
	visionMaxEncoded = 800 * 1024
	visionJPEGQuality = 80
)

// prepareVisionImage downscales and re-encodes image bytes for multimodal turns.
// When the original is already small enough and within side limits, it is
// returned unchanged.
func prepareVisionImage(data []byte, mediaType string) ([]byte, string, error) {
	img, err := decodeImage(data, mediaType)
	if err != nil {
		if len(data) <= visionMaxEncoded {
			return data, mediaType, nil
		}
		return nil, "", fmt.Errorf("decode image for vision: %w", err)
	}
	b := img.Bounds()
	needsResize := b.Dx() > visionMaxSide || b.Dy() > visionMaxSide
	if !needsResize && len(data) <= visionMaxEncoded {
		return data, mediaType, nil
	}
	img = fitMaxSide(img, visionMaxSide)
	encoded, encType, err := encodeVisionJPEG(img)
	if err != nil {
		return nil, "", err
	}
	if !needsResize && len(data) <= len(encoded) && len(data) <= visionMaxEncoded {
		return data, mediaType, nil
	}
	if len(encoded) <= visionMaxEncoded {
		return encoded, encType, nil
	}
	return shrinkUntilFit(img)
}

func decodeImage(data []byte, mediaType string) (image.Image, error) {
	r := bytes.NewReader(data)
	switch mediaType {
	case "image/png":
		return png.Decode(r)
	case "image/jpeg":
		return jpeg.Decode(r)
	case "image/gif":
		g, err := gif.DecodeAll(r)
		if err != nil {
			return nil, err
		}
		if len(g.Image) == 0 {
			return nil, fmt.Errorf("gif has no frames")
		}
		return g.Image[0], nil
	default:
		img, _, err := image.Decode(r)
		return img, err
	}
}

func fitMaxSide(img image.Image, maxSide int) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= 0 || h <= 0 || (w <= maxSide && h <= maxSide) {
		return img
	}
	scale := float64(maxSide) / math.Max(float64(w), float64(h))
	nw := int(math.Max(1, math.Round(float64(w)*scale)))
	nh := int(math.Max(1, math.Round(float64(h)*scale)))
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Over, nil)
	return dst
}

func encodeVisionJPEG(img image.Image) ([]byte, string, error) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: visionJPEGQuality}); err != nil {
		return nil, "", fmt.Errorf("encode jpeg: %w", err)
	}
	return buf.Bytes(), "image/jpeg", nil
}

func shrinkUntilFit(img image.Image) ([]byte, string, error) {
	side := visionMaxSide
	quality := visionJPEGQuality
	for attempt := 0; attempt < 6; attempt++ {
		side = side * 3 / 4
		if side < 512 {
			side = 512
		}
		quality -= 10
		if quality < 40 {
			quality = 40
		}
		scaled := fitMaxSide(img, side)
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, scaled, &jpeg.Options{Quality: quality}); err != nil {
			return nil, "", fmt.Errorf("encode jpeg: %w", err)
		}
		if buf.Len() <= visionMaxEncoded {
			return buf.Bytes(), "image/jpeg", nil
		}
	}
	return nil, "", fmt.Errorf("image still too large after compression (max %d bytes)", visionMaxEncoded)
}
