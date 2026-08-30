import { useState } from "react"
import { useNavigate } from "react-router"
import { ManagePage } from "@/components/manage/manage-page"
import type { ToolInfo } from "@/types/agent"
import { AppDialogs } from "./app-dialogs"
import { useShell } from "./shell-context"

export function ManageRoute() {
  const shell = useShell()
  const navigate = useNavigate()
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null)
  return (
    <>
      <ManagePage
        agents={shell.agentMgr.agents}
        onViewAgent={(id) =>
          navigate(`/manage/agents/${encodeURIComponent(id)}`)
        }
        onEditAgent={(id) =>
          navigate(`/manage/agents/${encodeURIComponent(id)}/edit`)
        }
        onCopyAgent={(id) =>
          navigate(`/manage/agents/new?copy=${encodeURIComponent(id)}`)
        }
        onDeleteAgent={shell.agentMgr.handleDeleteAgent}
        onCreateAgent={() => navigate("/manage/agents/new")}
        onSelectTool={setSelectedTool}
        onEditSkill={(skill) =>
          navigate(
            `/manage/skills/${encodeURIComponent(skill.name)}/edit?scope=${skill.scope}${skill.agent ? `&agent=${encodeURIComponent(skill.agent)}` : ""}`
          )
        }
        onCreateSkill={() => navigate("/manage/skills/new")}
      />
      <AppDialogs
        agentMgr={shell.agentMgr}
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
      />
    </>
  )
}
