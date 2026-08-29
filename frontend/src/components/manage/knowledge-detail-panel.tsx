import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, RefreshCw, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchKnowledgeBase, fetchKnowledgeDocuments } from "@/lib/api"
import type {
  KnowledgeDocument,
  KnowledgeHit,
  KnowledgeMeta,
} from "@/types/agent"
import {
  runKbDelete,
  runKbDeleteDoc,
  runKbReindex,
  runKbSearch,
  runKbUpload,
} from "./knowledge-actions"
import { KnowledgeDocumentList } from "./knowledge-document-list"
import { KnowledgeSearchSection } from "./knowledge-search-section"

export function KnowledgeDetailPanel({
  kbId,
  onBack,
}: {
  kbId: string
  onBack: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const detail = useKnowledgeDetail(kbId, onBack)
  return (
    <div className="space-y-4">
      <KnowledgeDetailHeader
        kbId={kbId}
        name={detail.meta?.name}
        isBusy={detail.isBusy}
        onBack={onBack}
        onReindex={detail.onReindex}
        onDeleteKb={detail.onDeleteKb}
      />
      {detail.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {detail.error}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".md,.txt,.markdown,text/plain,text/markdown"
        className="hidden"
        onChange={detail.onUpload}
      />
      <KnowledgeDetailBody
        detail={detail}
        onPickFile={() => fileRef.current?.click()}
      />
    </div>
  )
}

function KnowledgeDetailBody({
  detail,
  onPickFile,
}: {
  detail: ReturnType<typeof useKnowledgeDetail>
  onPickFile: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={detail.isBusy}
        onClick={onPickFile}
      >
        <Upload className="h-3.5 w-3.5" /> {t("manage.knowledgeUpload")}
      </Button>
      <KnowledgeDocumentList
        docs={detail.docs}
        busy={detail.isBusy}
        onDeleteDoc={detail.onDeleteDoc}
      />
      <KnowledgeSearchSection
        query={detail.query}
        onQueryChange={detail.setQuery}
        busy={detail.isBusy}
        onSearch={detail.onSearch}
        hits={detail.hits}
      />
    </>
  )
}

function KnowledgeDetailHeader({
  kbId,
  name,
  isBusy,
  onBack,
  onReindex,
  onDeleteKb,
}: {
  kbId: string
  name?: string
  isBusy: boolean
  onBack: () => void
  onReindex: () => void
  onDeleteKb: () => void
}) {
  const { t } = useTranslation()
  return (
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
          {name ?? kbId}
        </h2>
        <p className="font-mono text-[10px] text-muted-foreground">{kbId}</p>
      </div>
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={isBusy}
          onClick={onReindex}
        >
          {isBusy ? (
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
          disabled={isBusy}
          onClick={onDeleteKb}
        >
          <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
        </Button>
      </div>
    </div>
  )
}

function useKnowledgeDetail(kbId: string, onBack: () => void) {
  const { t } = useTranslation()
  const [meta, setMeta] = useState<KnowledgeMeta | null>(null)
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [hits, setHits] = useState<KnowledgeHit[]>([])
  const [query, setQuery] = useState("")
  const [isBusy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ctl = { setBusy, setError }

  const reload = useCallback(() => {
    return Promise.all([
      fetchKnowledgeBase(kbId),
      fetchKnowledgeDocuments(kbId),
    ])
      .then(([m, d]) => {
        setMeta(m)
        setDocs(d)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }, [kbId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    meta,
    docs,
    hits,
    query,
    setQuery,
    isBusy,
    error,
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (file) void runKbUpload(kbId, file, reload, ctl)
    },
    onDeleteDoc: (docId: string) => {
      if (!window.confirm(t("manage.knowledgeDeleteDocConfirm"))) return
      void runKbDeleteDoc(kbId, docId, reload, ctl)
    },
    onReindex: () => void runKbReindex(kbId, reload, ctl),
    onSearch: () => void runKbSearch(kbId, query, setHits, ctl),
    onDeleteKb: () => {
      if (
        !window.confirm(
          t("manage.knowledgeDeleteConfirm", { name: meta?.name ?? kbId })
        )
      )
        return
      void runKbDelete(kbId, onBack, ctl)
    },
  }
}
