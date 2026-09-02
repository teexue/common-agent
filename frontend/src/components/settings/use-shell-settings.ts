import { useEffect, useState } from "react"
import {
  fetchShellSettings,
  saveShellSettings,
  type ShellInfo,
  type ShellSettings,
} from "@/lib/api"

const empty: ShellSettings = {
  os: "",
  selectable: false,
  shell: "auto",
  resolved: { id: "", name: "", path: "" },
  available: [],
}

export function useShellSettings() {
  const [view, setView] = useState<ShellSettings>(empty)
  const [shell, setShell] = useState("auto")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    fetchShellSettings()
      .then((v) => {
        setView(v)
        setShell(v.shell || "auto")
        setError(null)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [])
  const save = () => {
    setSaving(true)
    setError(null)
    setOk(false)
    saveShellSettings(shell)
      .then((saved) => {
        setView(saved)
        setShell(saved.shell || "auto")
        setOk(true)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setSaving(false))
  }
  return { view, shell, setShell, loading, saving, error, ok, save }
}

export type { ShellInfo }
