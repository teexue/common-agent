import { CheckCircle, ShieldQuestion, XCircle } from "lucide-react"
import type { AgentFormData } from "@/lib/agent-yaml"
import type { TFunction } from "i18next"

export function formatTokens(v: number): string {
  if (v >= 1048576 && v % 1048576 === 0) return `${v / 1048576}M`
  if (v >= 1024 && v % 1024 === 0) return `${v / 1024}K`
  return String(v)
}

export type ToolPermission = "auto_approve" | "confirm" | "deny"

export function getToolPermission(
  form: AgentFormData,
  tool: string
): ToolPermission {
  if (form.autoApprove.includes(tool)) return "auto_approve"
  if (form.alwaysDeny.includes(tool)) return "deny"
  return "confirm"
}

export function setToolPermission(
  form: AgentFormData,
  tool: string,
  perm: ToolPermission
): AgentFormData {
  const autoApprove = form.autoApprove.filter((x) => x !== tool)
  const alwaysDeny = form.alwaysDeny.filter((x) => x !== tool)
  if (perm === "auto_approve")
    return { ...form, autoApprove: [...autoApprove, tool], alwaysDeny }
  if (perm === "deny")
    return { ...form, autoApprove, alwaysDeny: [...alwaysDeny, tool] }
  return { ...form, autoApprove, alwaysDeny }
}

export function getPermConfig(t: TFunction) {
  return {
    auto_approve: {
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
      label: t("agent.permAuto"),
    },
    confirm: {
      icon: ShieldQuestion,
      color: "text-warning",
      bg: "bg-warning/10",
      label: t("agent.permConfirm"),
    },
    deny: {
      icon: XCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      label: t("agent.permDeny"),
    },
  } as const
}
