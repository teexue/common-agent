package tui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

const pulseTick = 80 * time.Millisecond

// pulseMsg advances the streaming pulse animation.
type pulseMsg struct{}

// pulseCmd schedules the next pulse frame while streaming.
func pulseCmd() tea.Cmd {
	return tea.Tick(pulseTick, func(time.Time) tea.Msg { return pulseMsg{} })
}

// pulseBar renders a short sliding accent bar driven by frame index.
func pulseBar(theme Theme, width, frame int) string {
	if width < 8 {
		width = 8
	}
	const head = 6
	pos := frame % width
	buf := make([]rune, width)
	for i := range buf {
		buf[i] = '─'
	}
	for i := 0; i < head; i++ {
		idx := (pos + i) % width
		buf[idx] = '━'
	}
	return theme.PulseBar.Render(string(buf))
}

// statusGlyph returns an animated or static status marker.
func statusGlyph(streaming bool, frame int, spinView string) string {
	if streaming {
		return spinView
	}
	if frame%2 == 0 {
		return "●"
	}
	return "○"
}
