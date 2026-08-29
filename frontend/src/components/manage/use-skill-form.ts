import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import {
  createSkill,
  fetchAgents,
  fetchSkill,
  updateSkill,
  type SkillPayload,
} from "@/lib/api"
import type { AgentInfo, SkillInfo } from "@/types/agent"

export interface SkillFormState {
  name: string
  description: string
  body: string
  license: string
  allowedTools: string
  scope: "global" | "agent"
  agent: string
}

export function isValidSkillName(name: string): boolean {
  return (
    /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/.test(name) && !name.includes("--")
  )
}

export function initialFormState(
  mode: "create" | "edit",
  skill: SkillInfo | null,
  agents: AgentInfo[]
): SkillFormState {
  if (mode === "edit" && skill) {
    return {
      name: skill.name,
      description: skill.description,
      body: "",
      license: "",
      allowedTools: "",
      scope: skill.scope,
      agent: skill.agent ?? "",
    }
  }
  return {
    name: "",
    description: "",
    body: "",
    license: "",
    allowedTools: "",
    scope: "global",
    agent: agents[0]?.id || agents[0]?.name || "",
  }
}

export function useSkillForm(opts: {
  mode: "create" | "edit"
  skill: SkillInfo | null
}) {
  const { mode, skill } = opts
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [form, setForm] = useState<SkillFormState>(() =>
    initialFormState(mode, skill, agents)
  )
  const [detailLoading, setDetailLoading] = useState(mode === "edit" && !!skill)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => loadAgents(setAgents), [])
  useEffect(
    () => loadSkillDetail(mode, skill, setForm, setError, setDetailLoading),
    [mode, skill]
  )

  return {
    agents,
    form,
    setForm,
    detailLoading,
    saving,
    setSaving,
    error,
    setError,
  }
}

function loadAgents(setAgents: (a: AgentInfo[]) => void) {
  let cancelled = false
  fetchAgents()
    .then((d) => {
      if (!cancelled) setAgents(d ?? [])
    })
    .catch(() => {
      if (!cancelled) setAgents([])
    })
  return () => {
    cancelled = true
  }
}

function loadSkillDetail(
  mode: "create" | "edit",
  skill: SkillInfo | null,
  setForm: Dispatch<SetStateAction<SkillFormState>>,
  setError: (msg: string) => void,
  setDetailLoading: (v: boolean) => void
) {
  if (mode !== "edit" || !skill) return
  let cancelled = false
  fetchSkill(skill.name, skill.scope, skill.agent)
    .then((d) => {
      if (cancelled) return
      setForm((f) => ({
        ...f,
        description: d.description,
        body: d.body,
        license: d.license ?? "",
        allowedTools: d.allowed_tools ?? "",
      }))
    })
    .catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err))
    })
    .finally(() => {
      if (!cancelled) setDetailLoading(false)
    })
  return () => {
    cancelled = true
  }
}

export async function submitSkillForm(opts: {
  mode: "create" | "edit"
  skill: SkillInfo | null
  form: SkillFormState
  t: (key: string) => string
  setError: (msg: string) => void
  setSaving: (v: boolean) => void
  onSaved: () => void
}) {
  opts.setError("")
  if (opts.mode === "create" && !isValidSkillName(opts.form.name.trim())) {
    opts.setError(opts.t("manage.skillsNameInvalid"))
    return
  }
  const payload: SkillPayload = {
    name: opts.form.name.trim(),
    description: opts.form.description.trim(),
    body: opts.form.body,
    license: opts.form.license.trim() || undefined,
    allowed_tools: opts.form.allowedTools.trim() || undefined,
    scope: opts.form.scope,
    agent: opts.form.scope === "agent" ? opts.form.agent : undefined,
  }
  opts.setSaving(true)
  try {
    if (opts.mode === "edit" && opts.skill)
      await updateSkill(opts.skill.name, payload)
    else await createSkill(payload)
    opts.onSaved()
  } catch (err) {
    opts.setError(err instanceof Error ? err.message : String(err))
  } finally {
    opts.setSaving(false)
  }
}
