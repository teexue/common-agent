import { useEffect, useState } from "react"
import { Bot, Edit3, Loader2, Settings, Shield, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { fetchAgentDetail } from "@/lib/api"
import type { AgentDetail } from "@/types/agent"

interface AgentDetailDialogProps {
  agentName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (name: string) => void
  onDelete?: (name: string) => void
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-xs font-medium text-foreground">{value}</p>
    </div>
  )
}

function AgentHeader({ detail, onEdit, onDelete }: { detail: AgentDetail; onEdit?: (n: string) => void; onDelete?: (n: string) => void }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h3 className="font-heading text-base text-foreground">{detail.name}</h3>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] font-mono">{detail.provider}</Badge>
          <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-mono">{detail.model}</Badge>
        </div>
      </div>
      <div className="flex gap-1.5">
        {onEdit && <Button variant="outline" size="sm" className="h-7 gap-1.5 rounded-lg text-xs" onClick={() => onEdit(detail.name)}><Edit3 className="h-3 w-3" /> 编辑</Button>}
        {onDelete && <Button variant="outline" size="sm" className="h-7 gap-1.5 rounded-lg border-destructive/30 text-xs text-destructive hover:bg-destructive/10" onClick={() => onDelete(detail.name)}>删除</Button>}
      </div>
    </div>
  )
}

function PermissionsSection({ permissions }: { permissions: NonNullable<AgentDetail["permissions"]> }) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Shield className="h-3 w-3" /> 权限策略</h4>
      <div className="flex flex-col gap-2">
        {permissions.auto_approve && permissions.auto_approve.length > 0 && (
          <div>
            <span className="text-[10px] text-muted-foreground">自动批准:</span>
            <div className="mt-0.5 flex flex-wrap gap-1">{permissions.auto_approve.map((t) => <Badge key={t} variant="secondary" className="rounded-md bg-success/10 px-1.5 py-0 text-[10px] text-success">{t}</Badge>)}</div>
          </div>
        )}
        {permissions.always_deny && permissions.always_deny.length > 0 && (
          <div>
            <span className="text-[10px] text-muted-foreground">始终拒绝:</span>
            <div className="mt-0.5 flex flex-wrap gap-1">{permissions.always_deny.map((t) => <Badge key={t} variant="secondary" className="rounded-md bg-destructive/10 px-1.5 py-0 text-[10px] text-destructive">{t}</Badge>)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function AgentDetailDialog({ agentName, open, onOpenChange, onEdit, onDelete }: AgentDetailDialogProps) {
  const [detail, setDetail] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !agentName) { setDetail(null); setError(null); return }
    setLoading(true); setError(null)
    fetchAgentDetail(agentName).then(setDetail).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [open, agentName])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm tracking-tight"><Bot className="h-4 w-4 text-primary" /> Agent 详情</DialogTitle>
        </DialogHeader>
        {loading && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{error}</div>}
        {detail && (
          <ScrollArea className="max-h-[70vh]">
            <div className="flex flex-col gap-4">
              <AgentHeader detail={detail} onEdit={onEdit} onDelete={onDelete} />
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="最大轮次" value={String(detail.max_turns)} />
                <InfoCard label="最大 Tokens" value={detail.max_tokens ? String(detail.max_tokens) : "无限制"} />
                {detail.tool_execution && <><InfoCard label="执行模式" value={detail.tool_execution.Mode === "parallel" ? "并行" : "串行"} /><InfoCard label="最大并行数" value={String(detail.tool_execution.MaxParallel)} /></>}
              </div>
              {detail.system_prompt && (
                <div>
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Settings className="h-3 w-3" /> 系统提示词</h4>
                  <div className="max-h-40 overflow-auto rounded-xl border border-border bg-muted/50 p-3"><pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">{detail.system_prompt}</pre></div>
                </div>
              )}
              {(detail.tools ?? []).length > 0 && (
                <div>
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Wrench className="h-3 w-3" /> 工具 ({(detail.tools ?? []).length})</h4>
                  <div className="flex flex-wrap gap-1.5">{(detail.tools ?? []).map((t) => <Badge key={t} variant="secondary" className="rounded-md px-2 py-0.5 font-mono text-[10px]">{t}</Badge>)}</div>
                </div>
              )}
              {detail.permissions && <PermissionsSection permissions={detail.permissions} />}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
