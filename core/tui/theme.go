package tui

import (
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/lipgloss"
)

// Shared AdaptiveColor palette for both the line renderer and fullscreen app.
var (
	accent = lipgloss.AdaptiveColor{Light: "#0F766E", Dark: "#2DD4BF"}
	muted  = lipgloss.AdaptiveColor{Light: "#64748B", Dark: "#94A3B8"}
	dim    = lipgloss.AdaptiveColor{Light: "#94A3B8", Dark: "#64748B"}
	tool   = lipgloss.AdaptiveColor{Light: "#C2410C", Dark: "#FB923C"}
	ok     = lipgloss.AdaptiveColor{Light: "#15803D", Dark: "#4ADE80"}
	errC   = lipgloss.AdaptiveColor{Light: "#B91C1C", Dark: "#F87171"}
	title  = lipgloss.AdaptiveColor{Light: "#0F172A", Dark: "#F8FAFC"}
	rule   = lipgloss.AdaptiveColor{Light: "#CBD5E1", Dark: "#334155"}
	panel  = lipgloss.AdaptiveColor{Light: "#F1F5F9", Dark: "#1E293B"}
	warn   = lipgloss.AdaptiveColor{Light: "#B45309", Dark: "#FBBF24"}
)

// Theme holds lipgloss styles for the fullscreen chat app.
type Theme struct {
	Accent, Muted, Dim, Tool, Ok, Err, Title, Rule, Panel, Warn lipgloss.Style
	Sidebar, Header, Composer, Approval, MsgUser, MsgAssistant  lipgloss.Style
	StatusDot, PulseBar                                         lipgloss.Style
}

// DefaultTheme builds the product teal theme.
func DefaultTheme() Theme {
	return Theme{
		Accent: lipgloss.NewStyle().Foreground(accent).Bold(true),
		Muted:  lipgloss.NewStyle().Foreground(muted),
		Dim:    lipgloss.NewStyle().Foreground(dim),
		Tool:   lipgloss.NewStyle().Foreground(tool),
		Ok:     lipgloss.NewStyle().Foreground(ok),
		Err:    lipgloss.NewStyle().Foreground(errC).Bold(true),
		Title:  lipgloss.NewStyle().Foreground(title).Bold(true),
		Rule:   lipgloss.NewStyle().Foreground(rule),
		Panel:  lipgloss.NewStyle().Foreground(title).Background(panel),
		Warn:   lipgloss.NewStyle().Foreground(warn).Bold(true),
		Sidebar: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, true, false, false).
			BorderForeground(rule).
			Padding(0, 1),
		Header: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, false, true, false).
			BorderForeground(rule).
			Padding(0, 1),
		Composer: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(accent).
			Padding(0, 1),
		Approval: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(warn).
			Padding(0, 1),
		MsgUser: lipgloss.NewStyle().
			Foreground(accent).
			Bold(true),
		MsgAssistant: lipgloss.NewStyle().
			Foreground(title),
		StatusDot: lipgloss.NewStyle().Foreground(accent).Bold(true),
		PulseBar:  lipgloss.NewStyle().Foreground(accent),
	}
}

// NewSpinner returns a spinner styled with the accent color.
func NewSpinner() spinner.Model {
	s := spinner.New()
	s.Spinner = spinner.MiniDot
	s.Style = lipgloss.NewStyle().Foreground(accent)
	return s
}
