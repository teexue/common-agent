import { createContext, useContext, type ReactNode } from "react"
import type { ShellNav } from "./shell-hooks"

const ShellNavContext = createContext<ShellNav | null>(null)

export function ShellNavProvider({
  value,
  children,
}: {
  value: ShellNav
  children: ReactNode
}) {
  return (
    <ShellNavContext.Provider value={value}>
      {children}
    </ShellNavContext.Provider>
  )
}

export function useShell(): ShellNav {
  const ctx = useContext(ShellNavContext)
  if (!ctx) {
    throw new Error("useShell must be used inside ShellNavProvider")
  }
  return ctx
}
