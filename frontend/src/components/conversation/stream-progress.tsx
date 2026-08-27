interface StreamProgressProps {
  active: boolean
}

/** Thin indeterminate progress bar pinned to the top of the chat stream. */
export function StreamProgress({ active }: StreamProgressProps) {
  if (!active) return null
  return <div className="stream-progress" aria-hidden />
}
