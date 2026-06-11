interface StreamingTextProps {
  text: string
  isStreaming: boolean
}

export function StreamingText({ text, isStreaming }: StreamingTextProps) {
  return (
    <span className="whitespace-pre-wrap">
      {text}
      {isStreaming && (
        <span className="inline-block w-px animate-pulse bg-primary align-middle" style={{ height: "1em" }} />
      )}
    </span>
  )
}
