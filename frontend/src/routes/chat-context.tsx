import { createContext, useContext, useEffect, type ReactNode } from "react"
import { useChat } from "@/hooks/use-chat"
import { setSessionRunning } from "./session-store"

const ChatContext = createContext<ReturnType<typeof useChat> | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChat()
  useEffect(() => {
    setSessionRunning(chat.sessionId, chat.isStreaming)
  }, [chat.sessionId, chat.isStreaming])
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>
}

export function useWorkspaceChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error("useWorkspaceChat must be used inside ChatProvider")
  }
  return ctx
}
