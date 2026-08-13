import { useEffect, useRef } from "react"

interface ShortcutHandlers {
  onToggleSidebar?: () => void
  onClosePanel?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  // Keep the latest handlers without re-binding the window listener on every
  // render (callers pass fresh object literals each render).
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Cmd/Ctrl + Shift + S: toggle sidebar
      if (mod && e.shiftKey && e.key === "s") {
        e.preventDefault()
        handlersRef.current.onToggleSidebar?.()
      }

      // Escape: close panel — but never while a dialog/sheet is open, the
      // modal owns the Escape key and closing it shouldn't collapse the panel.
      if (e.key === "Escape") {
        if (document.querySelector('[role="dialog"]')) return
        handlersRef.current.onClosePanel?.()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
}
