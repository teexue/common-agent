import { useCallback, useEffect, useRef } from "react"

export function useAutoScroll<T>(dependency: T, behavior: ScrollBehavior = "smooth") {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const threshold = 100
    shouldAutoScroll.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      })
    }
  }, [dependency, behavior])

  return { containerRef, handleScroll }
}
