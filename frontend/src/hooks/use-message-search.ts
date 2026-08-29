import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { ConversationEntry } from "@/types/agent"

function findMatches(messages: ConversationEntry[], query: string) {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return messages
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      const content = entry.content?.toLowerCase() ?? ""
      const reasoning = entry.reasoningContent?.toLowerCase() ?? ""
      const toolNames =
        entry.toolCalls?.map((tc) => tc.name.toLowerCase()).join(" ") ?? ""
      return (
        content.includes(q) || reasoning.includes(q) || toolNames.includes(q)
      )
    })
}

/** useMessageSearch implements conversation search: query, matches, and match navigation. */
export function useMessageSearch(messages: ConversationEntry[]) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentMatch, setCurrentMatch] = useState(0)
  const matchRefs = useRef<HTMLDivElement[]>([])
  const searchResults = useMemo(
    () => findMatches(messages, searchQuery),
    [messages, searchQuery]
  )
  const matchedIndices = useMemo(
    () => new Set(searchResults.map((r) => r.index)),
    [searchResults]
  )
  useScrollToMatch(matchRefs, currentMatch, searchResults.length)
  const nav = useSearchNav(
    searchResults.length,
    setSearchQuery,
    setSearchOpen,
    setCurrentMatch,
    matchRefs
  )
  return {
    searchOpen,
    setSearchOpen,
    toggleOpen: nav.toggleOpen,
    searchQuery,
    setSearchQuery: nav.handleSearch,
    currentMatch,
    searchResults,
    matchedIndices,
    matchRefs,
    handlePrev: nav.handlePrev,
    handleNext: nav.handleNext,
    handleClear: nav.handleClear,
  }
}

function useScrollToMatch(
  matchRefs: React.RefObject<HTMLDivElement[]>,
  currentMatch: number,
  resultCount: number
) {
  useEffect(() => {
    if (resultCount > 0) {
      matchRefs.current[currentMatch]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }
  }, [currentMatch, resultCount, matchRefs])
}

function useSearchNav(
  length: number,
  setSearchQuery: (q: string) => void,
  setSearchOpen: (v: boolean | ((p: boolean) => boolean)) => void,
  setCurrentMatch: (v: number | ((p: number) => number)) => void,
  matchRefsRef: React.MutableRefObject<HTMLDivElement[]>
) {
  const handlePrev = useCallback(
    () => setCurrentMatch((p) => (p > 0 ? p - 1 : length - 1)),
    [length, setCurrentMatch]
  )
  const handleNext = useCallback(
    () => setCurrentMatch((p) => (p < length - 1 ? p + 1 : 0)),
    [length, setCurrentMatch]
  )
  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q)
      setCurrentMatch(0)
    },
    [setSearchQuery, setCurrentMatch]
  )
  const handleClear = useCallback(() => {
    setSearchQuery("")
    setSearchOpen(false)
    setCurrentMatch(0)
    matchRefsRef.current = []
  }, [setSearchQuery, setSearchOpen, setCurrentMatch, matchRefsRef])
  const toggleOpen = useCallback(
    () => setSearchOpen((v) => !v),
    [setSearchOpen]
  )
  return { handlePrev, handleNext, handleSearch, handleClear, toggleOpen }
}

/** MessageSearch is the search state shared between the top bar actions and the conversation. */
export type MessageSearch = ReturnType<typeof useMessageSearch>
