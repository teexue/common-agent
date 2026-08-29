import { useCallback, useLayoutEffect, useRef } from "react"

interface AutoScrollOptions {
  behavior?: ScrollBehavior
  /** When this changes (e.g. session id), stick to bottom and jump without animating. */
  resetKey?: string | null
}

export function useAutoScroll<T>(
  dependency: T,
  { behavior = "smooth", resetKey }: AutoScrollOptions = {}
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const prevResetKey = useRef(resetKey)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    shouldAutoScroll.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  useLayoutEffect(() => {
    if (prevResetKey.current !== resetKey) {
      prevResetKey.current = resetKey
      shouldAutoScroll.current = true
    }
    const el = containerRef.current
    if (!shouldAutoScroll.current || !el) return
    el.scrollTo({
      top: el.scrollHeight,
      behavior: behavior === "smooth" ? "smooth" : "auto",
    })
  }, [dependency, behavior, resetKey])

  return { containerRef, handleScroll }
}
