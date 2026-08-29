import {
  deleteKnowledgeBase,
  deleteKnowledgeDocument,
  reindexKnowledgeBase,
  searchKnowledge,
  uploadKnowledgeDocument,
} from "@/lib/api"
import type { KnowledgeHit } from "@/types/agent"

interface KnowledgeBusy {
  setBusy: (v: boolean) => void
  setError: (v: string | null) => void
}

export async function runKbUpload(
  kbId: string,
  file: File,
  reload: () => Promise<void>,
  busy: KnowledgeBusy
) {
  busy.setBusy(true)
  busy.setError(null)
  try {
    await uploadKnowledgeDocument(kbId, file)
    await reload()
  } catch (err) {
    busy.setError(err instanceof Error ? err.message : String(err))
    busy.setBusy(false)
  }
}

export async function runKbDeleteDoc(
  kbId: string,
  docId: string,
  reload: () => Promise<void>,
  busy: KnowledgeBusy
) {
  busy.setBusy(true)
  try {
    await deleteKnowledgeDocument(kbId, docId)
    await reload()
  } catch (err) {
    busy.setError(err instanceof Error ? err.message : String(err))
    busy.setBusy(false)
  }
}

export async function runKbReindex(
  kbId: string,
  reload: () => Promise<void>,
  busy: KnowledgeBusy
) {
  busy.setBusy(true)
  busy.setError(null)
  try {
    await reindexKnowledgeBase(kbId)
    await reload()
  } catch (err) {
    busy.setError(err instanceof Error ? err.message : String(err))
    busy.setBusy(false)
  }
}

export async function runKbSearch(
  kbId: string,
  query: string,
  setHits: (h: KnowledgeHit[]) => void,
  busy: KnowledgeBusy
) {
  busy.setBusy(true)
  busy.setError(null)
  try {
    setHits(await searchKnowledge({ query, kb_ids: [kbId], top_k: 5 }))
  } catch (err) {
    busy.setError(err instanceof Error ? err.message : String(err))
  } finally {
    busy.setBusy(false)
  }
}

export async function runKbDelete(
  kbId: string,
  onBack: () => void,
  busy: KnowledgeBusy
) {
  busy.setBusy(true)
  busy.setError(null)
  try {
    await deleteKnowledgeBase(kbId)
    onBack()
  } catch (e) {
    busy.setError(e instanceof Error ? e.message : String(e))
    busy.setBusy(false)
  }
}
