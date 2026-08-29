import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { BookOpen, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/shared/empty-state"
import { ListRow } from "@/components/shared/list-row"
import { createKnowledgeBase, fetchKnowledgeBases } from "@/lib/api"
import type { KnowledgeMeta } from "@/types/agent"

export function KnowledgeListPanel({
  onOpen,
}: {
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const list = useKnowledgeList()
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {t("manage.knowledgeHint")}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => list.setCreating((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" /> {t("manage.knowledgeCreate")}
        </Button>
      </div>
      {list.creating && <KnowledgeCreateForm list={list} />}
      {list.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {list.error}
        </p>
      )}
      <KnowledgeBaseRows list={list} onOpen={onOpen} />
    </div>
  )
}

function KnowledgeCreateForm({
  list,
}: {
  list: ReturnType<typeof useKnowledgeList>
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <Input
        value={list.id}
        onChange={(e) => list.setId(e.target.value)}
        placeholder={t("manage.knowledgeId")}
        className="h-8 rounded-xl text-xs"
      />
      <Input
        value={list.name}
        onChange={(e) => list.setName(e.target.value)}
        placeholder={t("manage.knowledgeName")}
        className="h-8 rounded-xl text-xs"
      />
      <Button
        size="sm"
        className="h-8 text-xs"
        disabled={!list.id.trim()}
        onClick={list.handleCreate}
      >
        {t("common.create")}
      </Button>
    </div>
  )
}

function KnowledgeBaseRows({
  list,
  onOpen,
}: {
  list: ReturnType<typeof useKnowledgeList>
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  if (list.loading) return <EmptyState title={t("manage.loading")} />
  if (list.bases.length === 0)
    return <EmptyState title={t("manage.knowledgeEmpty")} />
  return (
    <>
      {list.bases.map((kb) => (
        <ListRow
          key={kb.id}
          onClick={() => onOpen(kb.id)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{kb.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className="rounded-md px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {kb.id}
              </Badge>
              <Badge
                variant="secondary"
                className="rounded-md px-1.5 py-0.5 text-[10px]"
              >
                {t("manage.knowledgeDocsCount", { count: kb.doc_count })}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-md px-1.5 py-0.5 text-[10px]"
              >
                {t("manage.knowledgeChunksCount", { count: kb.chunk_count })}
              </Badge>
            </div>
          </div>
        </ListRow>
      ))}
    </>
  )
}

function useKnowledgeList() {
  const [bases, setBases] = useState<KnowledgeMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [id, setId] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    fetchKnowledgeBases()
      .then(setBases)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchKnowledgeBases()
      .then(setBases)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    setError(null)
    try {
      await createKnowledgeBase({
        id: id.trim(),
        name: name.trim() || id.trim(),
      })
      setId("")
      setName("")
      setCreating(false)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return {
    bases,
    loading,
    creating,
    setCreating,
    id,
    setId,
    name,
    setName,
    error,
    handleCreate,
  }
}
