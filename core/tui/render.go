package tui

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/teexue/common-agent/core/event"
)

// RenderOptions controls terminal output behavior.
type RenderOptions struct {
	// QuietDone suppresses the done footer (status/turns).
	QuietDone bool
	// ShowReasoning prints reasoning deltas in dim style.
	ShowReasoning bool
}

// DefaultRenderOptions is tuned for interactive chat.
var DefaultRenderOptions = RenderOptions{
	QuietDone:     true,
	ShowReasoning: true,
}

// Renderer streams agent events to a terminal with Claude Code–style formatting.
type Renderer struct {
	out    io.Writer
	opts   RenderOptions
	opened bool // assistant block started
}

// NewRenderer creates a renderer writing to w.
func NewRenderer(w io.Writer, opts RenderOptions) *Renderer {
	if w == nil {
		w = os.Stdout
	}
	return &Renderer{out: w, opts: opts}
}

// RenderEvents consumes events until the channel closes.
func (r *Renderer) RenderEvents(events <-chan event.Event) {
	for ev := range events {
		r.render(ev)
	}
}

func (r *Renderer) render(ev event.Event) {
	switch ev.Type {
	case event.TypeTextDelta:
		r.ensureAssistantBlock()
		_, _ = io.WriteString(r.out, ev.Content)

	case event.TypeReasoningDelta:
		if !r.opts.ShowReasoning {
			return
		}
		r.ensureAssistantBlock()
		_, _ = io.WriteString(r.out, dimStyle.Render(ev.Content))

	case event.TypeToolStart:
		r.ensureAssistantBlock()
		r.closeLine()
		input := formatJSON(ev.Input)
		line := fmt.Sprintf("⏺ %s(%s)", ev.Tool, input)
		_, _ = fmt.Fprintln(r.out, toolStyle.Render(line))

	case event.TypeToolResult:
		output := formatJSON(ev.Output)
		for _, line := range wrapToolResult(output) {
			_, _ = fmt.Fprintln(r.out, mutedStyle.Render("  ⎿  "+line))
		}

	case event.TypeError:
		r.closeLine()
		_, _ = fmt.Fprintln(r.out, Error(ev.Message))

	case event.TypeDone:
		r.closeLine()
		if !r.opts.QuietDone {
			status := ev.Status
			if status == "" {
				status = "unknown"
			}
			_, _ = fmt.Fprintln(r.out, Muted(fmt.Sprintf("done · %s · %d turns", status, ev.Turns)))
		}
		r.opened = false
	}
}

func (r *Renderer) ensureAssistantBlock() {
	if r.opened {
		return
	}
	r.opened = true
	_, _ = fmt.Fprintln(r.out)
	_, _ = fmt.Fprintln(r.out, accentStyle.Render("Assistant"))
}

func (r *Renderer) closeLine() {
	// noop — streaming handles newlines naturally; tool blocks add their own
}

func formatJSON(v any) string {
	if v == nil {
		return ""
	}
	switch x := v.(type) {
	case json.RawMessage:
		return compactJSON(string(x))
	case []byte:
		return compactJSON(string(x))
	default:
		b, err := json.Marshal(x)
		if err != nil {
			return fmt.Sprint(v)
		}
		return compactJSON(string(b))
	}
}

func compactJSON(s string) string {
	s = strings.TrimSpace(s)
	if s == "" || s == "null" || s == "{}" {
		return ""
	}
	if len(s) > 120 {
		return s[:117] + "..."
	}
	return s
}

func wrapToolResult(s string) []string {
	if s == "" {
		return []string{""}
	}
	const max = 100
	if len(s) <= max {
		return []string{s}
	}
	return []string{s[:max] + "..."}
}

// PrintWelcome shows a compact session header.
func PrintWelcome(scenario, providerName, model string) {
	border := borderStyle
	title := titleStyle.Render(" common-agent ")
	line := strings.Repeat("─", 42)

	top := border.Render("╭" + line + "╮")
	fmt.Println(top)
	fmt.Println(border.Render("│") + title + strings.Repeat(" ", 42-len(" common-agent ")) + border.Render("│"))
	fmt.Println(border.Render("│") + mutedStyle.Render(fmt.Sprintf(" scenario %-28s", scenario)) + border.Render("│"))
	fmt.Println(border.Render("│") + mutedStyle.Render(fmt.Sprintf(" provider %-28s", providerName)) + border.Render("│"))
	fmt.Println(border.Render("│") + mutedStyle.Render(fmt.Sprintf(" model    %-28s", model)) + border.Render("│"))
	fmt.Println(border.Render("╰" + line + "╯"))
	fmt.Println(hintStyle.Render("  /help 命令  ·  Ctrl+C 退出  ·  Enter 发送"))
}

// PrintHelp shows slash commands.
func PrintHelp() {
	fmt.Println()
	fmt.Println(accentStyle.Render("命令"))
	rows := []struct{ cmd, desc string }{
		{"/help", "显示帮助"},
		{"/exit", "退出"},
		{"/clear", "清空会话"},
		{"/scenario [name]", "切换或列出 scenario"},
		{"/tools [scenario]", "列出或验证工具"},
	}
	for _, row := range rows {
		fmt.Printf("  %-22s %s\n", toolStyle.Render(row.cmd), mutedStyle.Render(row.desc))
	}
	fmt.Println()
}
