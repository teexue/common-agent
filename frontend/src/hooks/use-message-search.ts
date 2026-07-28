import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { ConversationEntry } from "@/types/agent"

/** useMessageSearch implements conversation search: query, matches, and match navigation. */
export function useMessageSearch(messages: ConversationEntry[]) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentMatch, setCurrentMatch] = useState(0)
  const matchRefs = useRef<HTMLDivElement[]>([])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return messages.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
      const content = entry.content?.toLowerCase() ?? ""
      const reasoning = entry.reasoningContent?.toLowerCase() ?? ""
      const toolNames = entry.toolCalls?.map((tc) => tc.name.toLowerCase()).join(" ") ?? ""
      return content.includes(q) || reasoning.includes(q) || toolNames.includes(q)
    })
  }, [messages, searchQuery])

  const matchedIndices = useMemo(() => new Set(searchResults.map((r) => r.index)), [searchResults])

  useEffect(() => {
    if (searchResults.length > 0) {
      matchRefs.current[currentMatch]?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [currentMatch, searchResults])

  const handleSearch = useCallback((q: string) => { setSearchQuery(q); setCurrentMatch(0) }, [])
  const handlePrev = useCallback(() => setCurrentMatch((p) => p > 0 ? p - 1 : searchResults.length - 1), [searchResults.length])
  const handleNext = useCallback(() => setCurrentMatch((p) => p < searchResults.length - 1 ? p + 1 : 0), [searchResults.length])
  const handleClear = useCallback(() => { setSearchQuery(""); setSearchOpen(false); setCurrentMatch(0); matchRefs.current = [] }, [])
  const toggleOpen = useCallback(() => setSearchOpen((v) => !v), [])

  return { searchOpen, setSearchOpen, toggleOpen, searchQuery, setSearchQuery: handleSearch, currentMatch, searchResults, matchedIndices, matchRefs, handlePrev, handleNext, handleClear }
}

/** MessageSearch is the search state shared between the top bar actions and the conversation. */
export type MessageSearch = ReturnType<typeof useMessageSearch>
