import { useNavigate, useParams, useSearchParams } from "react-router"
import { SkillFormPage } from "@/components/manage/skill-form-page"
import type { SkillInfo } from "@/types/agent"

export function SkillFormRoute({ mode }: { mode: "create" | "edit" }) {
  const navigate = useNavigate()
  const { name } = useParams<{ name: string }>()
  const [searchParams] = useSearchParams()
  const scope = searchParams.get("scope") === "agent" ? "agent" : "global"
  const agent = searchParams.get("agent") ?? undefined
  const skill: SkillInfo | null =
    mode === "edit" && name
      ? {
          name: decodeURIComponent(name),
          version: "",
          description: "",
          format: "skill.md",
          scope,
          agent,
          tools: [],
        }
      : null
  return (
    <SkillFormPage
      mode={mode}
      skill={skill}
      onBack={() => navigate("/manage?tab=skills")}
      onSaved={() => navigate("/manage?tab=skills")}
    />
  )
}
