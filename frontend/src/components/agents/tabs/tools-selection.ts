import type { TFunction } from "i18next"
import type { AgentFormData } from "@/lib/agent-yaml"
import { toolDisplayDescription, toolDisplayName } from "@/lib/tool-i18n"
import type { ToolInfo } from "@/types/agent"

export function filterTools(
  tools: ToolInfo[],
  query: string,
  t: TFunction
): ToolInfo[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools
  return tools.filter((tool) => {
    const label = toolDisplayName(tool.name, t).toLowerCase()
    const desc = toolDisplayDescription(
      tool.name,
      tool.description,
      t
    ).toLowerCase()
    return (
      tool.name.toLowerCase().includes(q) ||
      label.includes(q) ||
      desc.includes(q) ||
      tool.description.toLowerCase().includes(q)
    )
  })
}

export function toggleToolInForm(
  prev: AgentFormData,
  name: string
): AgentFormData {
  if (prev.tools.includes(name)) {
    return {
      ...prev,
      tools: prev.tools.filter((x) => x !== name),
      autoApprove: prev.autoApprove.filter((x) => x !== name),
      alwaysDeny: prev.alwaysDeny.filter((x) => x !== name),
    }
  }
  return {
    ...prev,
    tools: [...prev.tools, name],
    autoApprove: [...prev.autoApprove, name],
  }
}

export function selectAllPatch(
  prev: AgentFormData,
  filteredNames: string[],
  allSelected: boolean
): AgentFormData {
  if (allSelected) {
    const drop = new Set(filteredNames)
    return {
      ...prev,
      tools: prev.tools.filter((x) => !drop.has(x)),
      autoApprove: prev.autoApprove.filter((x) => !drop.has(x)),
      alwaysDeny: prev.alwaysDeny.filter((x) => !drop.has(x)),
    }
  }
  const have = new Set(prev.tools)
  const add = filteredNames.filter((n) => !have.has(n))
  const haveAuto = new Set(prev.autoApprove)
  const addAuto = add.filter((n) => !haveAuto.has(n))
  return {
    ...prev,
    tools: [...prev.tools, ...add],
    autoApprove: [...prev.autoApprove, ...addAuto],
  }
}
