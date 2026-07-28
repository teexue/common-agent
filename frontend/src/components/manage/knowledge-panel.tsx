import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { BookOpen, Loader2, Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  deleteKnowledgeDocument,
  fetchKnowledgeBase,
  fetchKnowledgeBases,
  fetchKnowledgeDocuments,
  reindexKnowledgeBase,
  searchKnowledge,
  uploadKnowledgeDocument,
} from "@/lib/api"
import type { KnowledgeDocument, KnowledgeHit, KnowledgeMeta } from "@/types/agent"

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-10">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

/** Knowledge base list for Manage tab. */
export function KnowledgeListPanel({
  onOpen,
}: {
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const [bases, setBases] = useState<KnowledgeMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [id, setId] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    fetchKnowledgeBases()
      .then(setBases)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const handleCreate = async () => {
    setError(null)
    try {
      await createKnowledgeBase({ id: id.trim(), name: name.trim() || id.trim() })
      setId("")
      setName("")
      setCreating(false)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{t("manage.knowledgeHint")}</p>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={() => setCreating((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> {t("manage.knowledgeCreate")}
        </Button>
      </div>

      {creating && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder={t("manage.knowledgeId")} className="h-8 rounded-xl text-xs" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("manage.knowledgeName")} className="h-8 rounded-xl text-xs" />
          <Button size="sm" className="h-8 rounded-xl text-xs" disabled={!id.trim()} onClick={handleCreate}>
            {t("common.create")}
          </Button>
        </div>
      )}

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {loading ? (
        <EmptyState text={t("manage.loading")} />
      ) : bases.length === 0 ? (
        <EmptyState text={t("manage.knowledgeEmpty")} />
      ) : (
        bases.map((kb) => (
          <button
            key={kb.id}
            type="button"
            onClick={() => onOpen(kb.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/20 hover:bg-muted/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{kb.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="rounded-md px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{kb.id}</Badge>
                <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-[10px]">
                  {t("manage.knowledgeDocsCount", { count: kb.doc_count })}
                </Badge>
                <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-[10px]">
                  {t("manage.knowledgeChunksCount", { count: kb.chunk_count })}
                </Badge>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  )
}

/** Knowledge base detail: documents, upload, search, reindex. */
export function KnowledgeDetailPanel({
  kbId,
  onBack,
}: {
  kbId: string
  onBack: () => void
}) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [meta, setMeta] = useState<KnowledgeMeta | null>(null)
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [hits, setHits] = useState<KnowledgeHit[]>([])
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setBusy(true)
    setError(null)
    try {
      const [m, d] = await Promise.all([
        fetchKnowledgeBase(kbId),
        fetchKnowledgeDocuments(kbId),
      ])
      setMeta(m)
      setDocs(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void reload() }, [kbId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await uploadKnowledgeDocument(kbId, file)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm(t("manage.knowledgeDeleteDocConfirm"))) return
    setBusy(true)
    try {
      await deleteKnowledgeDocument(kbId, docId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const handleReindex = async () => {
    setBusy(true)
    setError(null)
    try {
      await reindexKnowledgeBase(kbId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const handleSearch = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await searchKnowledge({ query, kb_ids: [kbId], top_k: 5 })
      setHits(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteKb = async () => {
    if (!window.confirm(t("manage.knowledgeDeleteConfirm", { name: meta?.name ?? kbId }))) return
    await deleteKnowledgeBase(kbId)
    onBack()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={onBack}>
            ← {t("manage.knowledgeBack")}
          </button>
          <h2 className="mt-1 text-sm font-medium text-foreground">{meta?.name ?? kbId}</h2>
          <p className="font-mono text-[10px] text-muted-foreground">{kbId}</p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" disabled={busy} onClick={handleReindex}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t("manage.knowledgeReindex")}
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs text-destructive" disabled={busy} onClick={handleDeleteKb}>
            <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <input ref={fileRef} type="file" accept=".md,.txt,.markdown,text/plain,text/markdown" className="hidden" onChange={handleUpload} />
      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> {t("manage.knowledgeUpload")}
      </Button>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground">{t("manage.knowledgeDocuments")}</p>
        {docs.length === 0 ? (
          <EmptyState text={t("manage.knowledgeDocsEmpty")} />
        ) : (
          docs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-foreground">{d.filename}</p>
                <p className="text-[10px] text-muted-foreground">{d.chunk_count} chunks · {(d.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button variant="ghost" size="icon-xs" className="h-7 w-7 text-destructive" disabled={busy} onClick={() => handleDeleteDoc(d.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-border p-3">
        <p className="text-[11px] font-medium text-muted-foreground">{t("manage.knowledgeTrySearch")}</p>
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("manage.knowledgeSearchPlaceholder")} className="h-8 rounded-xl text-xs" />
          <Button size="sm" className="h-8 gap-1.5 rounded-xl text-xs" disabled={busy || !query.trim()} onClick={handleSearch}>
            <Search className="h-3.5 w-3.5" /> {t("manage.knowledgeSearch")}
          </Button>
        </div>
        {hits.map((h, i) => (
          <div key={`${h.doc_id}-${h.chunk_index}-${i}`} className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{h.filename} · score {h.score.toFixed(3)}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{h.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
