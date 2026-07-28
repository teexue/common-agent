import { useTranslation } from "react-i18next"
import { Download, FileJson, FileText, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { exportToJson, exportToMarkdown, downloadFile } from "@/lib/export"
import type { ConversationEntry } from "@/types/agent"

interface ConversationActionsProps {
  searchOpen: boolean
  onToggleSearch: () => void
  messages: ConversationEntry[]
  agentName: string
}

/** Conversation search + export buttons, rendered in the top bar. */
export function ConversationActions({ searchOpen, onToggleSearch, messages, agentName }: ConversationActionsProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant={searchOpen ? "secondary" : "ghost"}
              size="icon-xs"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={onToggleSearch}
            />
          }
        >
          <Search className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent>{t("conversation.searchPlaceholder")}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
            />
          }
        >
          <Download className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 rounded-xl">
          <DropdownMenuItem
            onClick={() => downloadFile(exportToMarkdown(messages, agentName), `${agentName}-${Date.now()}.md`, "text/markdown")}
            className="gap-2 text-xs"
          >
            <FileText className="h-3.5 w-3.5" /> {t("conversation.exportMarkdown")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => downloadFile(exportToJson(messages, agentName), `${agentName}-${Date.now()}.json`, "application/json")}
            className="gap-2 text-xs"
          >
            <FileJson className="h-3.5 w-3.5" /> {t("conversation.exportJson")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
