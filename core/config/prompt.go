package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/charmbracelet/huh"
	"golang.org/x/term"
)

func isInteractive() bool {
	return term.IsTerminal(int(os.Stdin.Fd()))
}

func huhTheme() *huh.Theme {
	return huh.ThemeCharm()
}

func selectOption(label string, items []string, defaultIdx int) (string, error) {
	if !isInteractive() {
		return fallbackSelect(label, items, defaultIdx)
	}
	if defaultIdx < 0 || defaultIdx >= len(items) {
		defaultIdx = 0
	}

	var choice string
	opts := make([]huh.Option[string], len(items))
	for i, item := range items {
		opts[i] = huh.NewOption(item, item)
	}
	choice = items[defaultIdx]

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewSelect[string]().
				Title(label).
				Description("↑↓ 选择 · Enter 确认").
				Options(opts...).
				Value(&choice),
		),
	).WithTheme(huhTheme())

	if err := form.Run(); err != nil {
		return "", err
	}
	return choice, nil
}

func inputString(label, defaultVal string) (string, error) {
	if !isInteractive() {
		return fallbackInput(label, defaultVal), nil
	}
	var value string
	if defaultVal != "" {
		value = defaultVal
	}
	field := huh.NewInput().
		Title(label).
		Value(&value)
	if defaultVal != "" {
		field = field.Placeholder(defaultVal)
	}
	form := huh.NewForm(huh.NewGroup(field)).WithTheme(huhTheme())
	if err := form.Run(); err != nil {
		return "", err
	}
	if value == "" {
		return defaultVal, nil
	}
	return value, nil
}

func inputSecret(label string) (string, error) {
	if !isInteractive() {
		return fallbackInput(label, ""), nil
	}
	var value string
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title(label).
				EchoMode(huh.EchoModePassword).
				Value(&value),
		),
	).WithTheme(huhTheme())
	if err := form.Run(); err != nil {
		return "", err
	}
	return strings.TrimSpace(value), nil
}

func fallbackSelect(label string, items []string, defaultIdx int) (string, error) {
	fmt.Println(label)
	for i, item := range items {
		mark := " "
		if i == defaultIdx {
			mark = "*"
		}
		fmt.Printf("  %s [%d] %s\n", mark, i+1, item)
	}
	fmt.Printf("选择 [1-%d，默认 %d]: ", len(items), defaultIdx+1)
	in := bufio.NewReader(os.Stdin)
	line, _ := in.ReadString('\n')
	line = strings.TrimSpace(line)
	if line == "" {
		return items[defaultIdx], nil
	}
	var n int
	if _, err := fmt.Sscanf(line, "%d", &n); err != nil || n < 1 || n > len(items) {
		return items[defaultIdx], nil
	}
	return items[n-1], nil
}

func fallbackInput(label, defaultVal string) string {
	if defaultVal != "" {
		fmt.Printf("%s [%s]: ", label, defaultVal)
	} else {
		fmt.Printf("%s: ", label)
	}
	line, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	line = strings.TrimSpace(line)
	if line == "" {
		return defaultVal
	}
	return line
}

// selectOrInput shows a list; choosing "自定义..." opens a text prompt.
func selectOrInput(label string, options []string, defaultIdx int, customLabel string) (string, error) {
	items := append(append([]string{}, options...), "自定义...")
	choice, err := selectOption(label, items, defaultIdx)
	if err != nil {
		return "", err
	}
	if choice != "自定义..." {
		return choice, nil
	}
	return inputString(customLabel, "")
}
