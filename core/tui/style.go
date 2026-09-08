package tui

import (
	"github.com/charmbracelet/lipgloss"
)

var (
	accentStyle = lipgloss.NewStyle().Foreground(accent).Bold(true)
	mutedStyle  = lipgloss.NewStyle().Foreground(muted)
	dimStyle    = lipgloss.NewStyle().Foreground(dim)
	toolStyle   = lipgloss.NewStyle().Foreground(tool)
	okStyle     = lipgloss.NewStyle().Foreground(ok)
	errStyle    = lipgloss.NewStyle().Foreground(errC).Bold(true)
	promptStyle = lipgloss.NewStyle().Foreground(accent).Bold(true)
	titleStyle  = lipgloss.NewStyle().Foreground(title).Bold(true)
	hintStyle   = lipgloss.NewStyle().Foreground(dim)
	ruleStyle   = lipgloss.NewStyle().Foreground(rule)
	labelStyle  = lipgloss.NewStyle().Foreground(accent).Bold(true)
)

// Prompt returns the chat input prefix (line renderer / non-fullscreen).
func Prompt() string {
	return promptStyle.Render("› ")
}

// Muted renders dim helper text.
func Muted(s string) string {
	return mutedStyle.Render(s)
}

// Error renders an error line.
func Error(s string) string {
	return errStyle.Render("✗  " + s)
}

// Success renders a success line.
func Success(s string) string {
	return okStyle.Render("✓  " + s)
}
