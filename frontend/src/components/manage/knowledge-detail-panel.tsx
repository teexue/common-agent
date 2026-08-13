import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, RefreshCw, Search, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/shared/empty-state"
import {
  deleteKnowledgeBase,
  deleteKnowledgeDocument,
  fetchKnowledgeBase,
  fetchKnowledgeDocuments,
  reindexKnowledgeBase,
  searchKnowledge,
  uploadKnowledgeDocument,
} from "@/lib/api"
import type {
  KnowledgeDocument,
  KnowledgeHit,
  KnowledgeMeta,
} from "@/types/agent"

function DocumentList({
  docs,
  busy,
  onDeleteDoc,
}: {
  docs: KnowledgeDocument[]
  busy: boolean
  onDeleteDoc: (docId: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground">
        {t("manage.knowledgeDocuments")}
      </p>
      {docs.length === 0 ? (
        <EmptyState title={t("manage.knowledgeDocsEmpty")} />
      ) : (
        docs.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-foreground">{d.filename}</p>
              <p className="text-[10px] text-muted-foreground">
                {d.chunk_count} chunks · {(d.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 text-destructive"
              disabled={busy}
              onClick={() => onDeleteDoc(d.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

function SearchSection({
  query,
  onQueryChange,
  busy,
  onSearch,
  hits,
}: {
  query: string
  onQueryChange: (value: string) => void
  busy: boolean
  onSearch: () => void
  hits: KnowledgeHit[]
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-[11px] font-medium text-muted-foreground">
        {t("manage.knowledgeTrySearch")}
      </p>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("manage.knowledgeSearchPlaceholder")}
          className="h-8 rounded-xl text-xs"
        />
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy || !query.trim()}
          onClick={onSearch}
        >
          <Search className="h-3.5 w-3.5" /> {t("manage.knowledgeSearch")}
        </Button>
      </div>
      {hits.map((h, i) => (
        <div
          key={`${h.doc_id}-${h.chunk_index}-${i}`}
          className="rounded-lg bg-muted/40 px-3 py-2"
        >
          <p className="text-[10px] text-muted-foreground">
            {h.filename} · score {h.score.toFixed(3)}
          </p>
          <p className="mt-1 text-xs whitespace-pre-wrap text-foreground">
            {h.text}
          </p>
        </div>
      ))}
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [kbId])

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
    if (
      !window.confirm(
        t("manage.knowledgeDeleteConfirm", { name: meta?.name ?? kbId })
      )
    )
      return
    setBusy(true)
    setError(null)
    try {
      await deleteKnowledgeBase(kbId)
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            ← {t("manage.knowledgeBack")}
          </button>
          <h2 className="mt-1 text-sm font-medium text-foreground">
            {meta?.name ?? kbId}
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground">{kbId}</p>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={busy}
            onClick={handleReindex}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t("manage.knowledgeReindex")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-destructive"
            disabled={busy}
            onClick={handleDeleteKb}
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".md,.txt,.markdown,text/plain,text/markdown"
        className="hidden"
        onChange={handleUpload}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" /> {t("manage.knowledgeUpload")}
      </Button>

      <DocumentList docs={docs} busy={busy} onDeleteDoc={handleDeleteDoc} />

      <SearchSection
        query={query}
        onQueryChange={setQuery}
        busy={busy}
        onSearch={handleSearch}
        hits={hits}
      />
    </div>
  )
}
