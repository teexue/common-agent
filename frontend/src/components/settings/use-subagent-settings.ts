import { useEffect, useState } from "react"
import {
  fetchSubagentSettings,
  saveSubagentSettings,
  type SubagentSettings,
} from "@/lib/api"

const empty: SubagentSettings = {
  enabled: true,
  max_turns: 5,
  timeout: 0,
  max_concurrent: 2,
}

function toForm(v: SubagentSettings): SubagentSettings {
  return {
    enabled: v.enabled,
    max_turns: v.max_turns,
    timeout: v.timeout,
    max_concurrent: v.max_concurrent,
  }
}

export function useSubagentSettings() {
  const [form, setForm] = useState<SubagentSettings>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    fetchSubagentSettings()
      .then((v) => {
        setForm(toForm(v))
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
    saveSubagentSettings(form)
      .then((saved) => {
        setForm(toForm(saved))
        setOk(true)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setSaving(false))
  }
  return { form, setForm, loading, saving, error, ok, save }
}
