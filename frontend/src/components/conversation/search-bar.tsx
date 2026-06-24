import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SearchBarProps {
  onSearch: (query: string) => void
  onClear: () => void
  matchCount: number
  currentMatch: number
  onPrev: () => void
  onNext: () => void
}

export function SearchBar({
  onSearch,
  onClear,
  matchCount,
  currentMatch,
  onPrev,
  onNext,
}: SearchBarProps) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, onSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (e.shiftKey) {
        onPrev()
      } else {
        onNext()
      }
    }
    if (e.key === "Escape") {
      onClear()
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="搜索消息..."
        className="h-6 flex-1 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
      />
      {query && (
        <>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : "无匹配"}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-5 w-5 rounded-md"
              onClick={onPrev}
              disabled={matchCount === 0}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-5 w-5 rounded-md"
              onClick={onNext}
              disabled={matchCount === 0}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5 rounded-md"
            onClick={() => {
              setQuery("")
              onClear()
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  )
}
