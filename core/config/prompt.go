package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/manifoldco/promptui"
	"golang.org/x/term"
)

func isInteractive() bool {
	return term.IsTerminal(int(os.Stdin.Fd()))
}

func selectOption(label string, items []string, defaultIdx int) (string, error) {
	if !isInteractive() {
		return fallbackSelect(label, items, defaultIdx)
	}
	p := promptui.Select{
		Label:     label,
		Items:     items,
		CursorPos: defaultIdx,
		Templates: &promptui.SelectTemplates{
			Label:    "{{ . }}",
			Active:   "▸ {{ . | cyan }}",
			Inactive: "  {{ . }}",
			Selected: "{{ . | green }}",
		},
	}
	idx, result, err := p.Run()
	if err != nil {
		return "", err
	}
	_ = idx
	return result, nil
}

func inputString(label, defaultVal string) (string, error) {
	if !isInteractive() {
		return fallbackInput(label, defaultVal), nil
	}
	p := promptui.Prompt{
		Label:   label,
		Default: defaultVal,
	}
	return p.Run()
}

func inputSecret(label string) (string, error) {
	if !isInteractive() {
		return fallbackInput(label, ""), nil
	}
	p := promptui.Prompt{
		Label: label,
		Mask:  '*',
	}
	return p.Run()
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
	var in *bufio.Reader
	in = bufio.NewReader(os.Stdin)
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
