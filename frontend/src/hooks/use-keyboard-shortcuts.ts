import { useEffect } from "react"

interface ShortcutHandlers {
  onToggleSidebar?: () => void
  onClosePanel?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Cmd/Ctrl + Shift + S: toggle sidebar
      if (mod && e.shiftKey && e.key === "s") {
        e.preventDefault()
        handlers.onToggleSidebar?.()
      }

      // Escape: close panel
      if (e.key === "Escape") {
        handlers.onClosePanel?.()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handlers])
}
