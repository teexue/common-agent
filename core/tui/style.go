package tui

import (
	"github.com/charmbracelet/lipgloss"
)

var (
	accentStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("39")).Bold(true)
	mutedStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	dimStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	toolStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("214"))
	okStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("42"))
	errStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Bold(true)
	promptStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("39")).Bold(true)
	borderStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("238"))
	titleStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("255")).Bold(true)
	hintStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("244")).Italic(true)
)

// Prompt returns the chat input prefix.
func Prompt() string {
	return promptStyle.Render("❯ ")
}

// Muted renders dim helper text.
func Muted(s string) string {
	return mutedStyle.Render(s)
}

// Error renders an error line.
func Error(s string) string {
	return errStyle.Render("✗ " + s)
}

// Success renders a success line.
func Success(s string) string {
	return okStyle.Render("✓ " + s)
}
