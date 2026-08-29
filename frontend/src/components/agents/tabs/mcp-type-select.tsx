import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { McpServerFormItem } from "@/lib/agent-yaml"
import { Field } from "./shared"

export function McpTypeSelect({
  server,
  onChange,
}: {
  server: McpServerFormItem
  onChange: (patch: Partial<McpServerFormItem>) => void
}) {
  const { t } = useTranslation()
  const stdioLabel = t("agent.mcpTypeStdio")
  const sseLabel = t("agent.mcpTypeSse")
  return (
    <Field label={t("agent.mcpType")}>
      <Select
        value={{
          value: server.type,
          label: server.type === "stdio" ? stdioLabel : sseLabel,
        }}
        onValueChange={(v) => {
          if (v && typeof v === "object" && "value" in v) {
            onChange({
              type: (v as { value: string }).value as "stdio" | "sse",
            })
          }
        }}
      >
        <SelectTrigger className="h-9 w-full rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value={{ value: "stdio", label: stdioLabel }}>
            {stdioLabel}
          </SelectItem>
          <SelectItem value={{ value: "sse", label: sseLabel }}>
            {sseLabel}
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )
}
