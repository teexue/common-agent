import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { AgentFormData } from "@/lib/agent-yaml"
import { toolDisplayDescription, toolDisplayName } from "@/lib/tool-i18n"
import type { ToolInfo } from "@/types/agent"
import { SectionCard } from "./shared"
import {
  getPermConfig,
  getToolPermission,
  setToolPermission,
  type ToolPermission,
} from "./perm-utils"

export function ToolsTab({
  form,
  setForm,
  tools,
}: {
  form: AgentFormData
  setForm: React.Dispatch<React.SetStateAction<AgentFormData>>
  tools: ToolInfo[]
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const permConfig = getPermConfig(t)

  const filtered = useMemo(() => {
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
  }, [tools, query, t])

  const toggleTool = (name: string) => {
    setForm((prev) => {
      if (prev.tools.includes(name)) {
        return {
          ...prev,
          tools: prev.tools.filter((x) => x !== name),
          autoApprove: prev.autoApprove.filter((x) => x !== name),
          alwaysDeny: prev.alwaysDeny.filter((x) => x !== name),
        }
      }
      return { ...prev, tools: [...prev.tools, name] }
    })
  }

  // Select-all operates on the currently filtered tool list.
  const filteredNames = useMemo(() => filtered.map((t) => t.name), [filtered])
  const selectedFiltered = useMemo(
    () => filteredNames.filter((n) => form.tools.includes(n)),
    [filteredNames, form.tools]
  )
  const allSelected =
    filteredNames.length > 0 && selectedFiltered.length === filteredNames.length
  const someSelected = selectedFiltered.length > 0

  const toggleSelectAll = () => {
    setForm((prev) => {
      if (allSelected) {
        // Deselect all filtered tools (and their permission entries).
        const drop = new Set(filteredNames)
        return {
          ...prev,
          tools: prev.tools.filter((x) => !drop.has(x)),
          autoApprove: prev.autoApprove.filter((x) => !drop.has(x)),
          alwaysDeny: prev.alwaysDeny.filter((x) => !drop.has(x)),
        }
      }
      // Select all filtered tools that aren't already selected.
      const have = new Set(prev.tools)
      const add = filteredNames.filter((n) => !have.has(n))
      return { ...prev, tools: [...prev.tools, ...add] }
    })
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={t("agent.sectionTools")}
        description={t("agent.sectionToolsDesc")}
      >
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/40">
            <input
              type="checkbox"
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected
              }}
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={filtered.length === 0}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            {allSelected
              ? t("agent.deselectAll")
              : t("agent.selectAll")}
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("agent.searchTools")}
              className="h-9 rounded-xl pl-8 text-sm"
            />
          </div>
          <Badge
            variant="secondary"
            className="rounded-md px-2 py-1 text-[10px]"
          >
            {t("agent.selectedCount", { count: form.tools.length })}
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={t("agent.noToolsMatch")} />
        ) : (
          <div className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((tool) => {
              const selected = form.tools.includes(tool.name)
              const perm = getToolPermission(form, tool.name)
              return (
                <div
                  key={tool.name}
                  className={`rounded-xl border px-3 py-2.5 transition-colors ${selected ? "border-primary/30 bg-primary/5" : "border-border bg-background hover:bg-muted/40"}`}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTool(tool.name)}
                      className="mt-1 h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">
                        {toolDisplayName(tool.name, t)}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {tool.name}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {toolDisplayDescription(tool.name, tool.description, t)}
                      </p>
                    </div>
                  </label>
                  {selected && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2 pl-6">
                      {(Object.keys(permConfig) as ToolPermission[]).map(
                        (p) => {
                          const c = permConfig[p]
                          const active = perm === p
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() =>
                                setForm((f) =>
                                  setToolPermission(f, tool.name, p)
                                )
                              }
                              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors ${
                                active
                                  ? `${c.bg} ${c.color} font-medium`
                                  : "text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              <c.icon className="h-3 w-3" /> {c.label}
                            </button>
                          )
                        }
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
