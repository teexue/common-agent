import i18n from "@/i18n"
import type {
  EmbeddingConfig,
  EmbeddingVendorInfo,
  KnowledgeDocument,
  KnowledgeHit,
  KnowledgeMeta,
} from "@/types/agent"

import { langHeaders } from "./client"

// ─── Knowledge API ────────────────────────────────────────────────

/** Lists knowledge bases. */
export async function fetchKnowledgeBases(): Promise<KnowledgeMeta[]> {
  const res = await fetch("/v1/knowledge", { headers: langHeaders() })
  if (!res.ok)
    throw new Error(i18n.t("api.fetchKnowledgeFailed", { status: res.status }))
  const data = await res.json()
  return data?.bases ?? []
}

/** Creates a knowledge base. */
export async function createKnowledgeBase(data: {
  id: string
  name: string
  description?: string
}): Promise<KnowledgeMeta> {
  const res = await fetch("/v1/knowledge", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ??
        i18n.t("api.createKnowledgeFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Fetches one knowledge base. */
export async function fetchKnowledgeBase(id: string): Promise<KnowledgeMeta> {
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(id)}`, {
    headers: langHeaders(),
  })
  if (!res.ok)
    throw new Error(i18n.t("api.fetchKnowledgeFailed", { status: res.status }))
  return res.json()
}

/** Updates knowledge base metadata. */
export async function updateKnowledgeBase(
  id: string,
  data: { name?: string; description?: string }
): Promise<KnowledgeMeta> {
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ??
        i18n.t("api.updateKnowledgeFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Deletes a knowledge base. */
export async function deleteKnowledgeBase(id: string): Promise<void> {
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: langHeaders(),
  })
  if (!res.ok)
    throw new Error(i18n.t("api.deleteKnowledgeFailed", { status: res.status }))
}

/** Lists documents in a knowledge base. */
export async function fetchKnowledgeDocuments(
  kbId: string
): Promise<KnowledgeDocument[]> {
  const res = await fetch(
    `/v1/knowledge/${encodeURIComponent(kbId)}/documents`,
    {
      headers: langHeaders(),
    }
  )
  if (!res.ok)
    throw new Error(
      i18n.t("api.fetchKnowledgeDocsFailed", { status: res.status })
    )
  const data = await res.json()
  return data?.documents ?? []
}

/** Uploads a document into a knowledge base. */
export async function uploadKnowledgeDocument(
  kbId: string,
  file: File
): Promise<KnowledgeDocument> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(
    `/v1/knowledge/${encodeURIComponent(kbId)}/documents`,
    {
      method: "POST",
      headers: langHeaders(),
      body: form,
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ??
        i18n.t("api.uploadKnowledgeDocFailed", { status: res.status })
    )
  }
  return res.json()
}

/** Deletes a document from a knowledge base. */
export async function deleteKnowledgeDocument(
  kbId: string,
  docId: string
): Promise<void> {
  const res = await fetch(
    `/v1/knowledge/${encodeURIComponent(kbId)}/documents/${encodeURIComponent(docId)}`,
    { method: "DELETE", headers: langHeaders() }
  )
  if (!res.ok)
    throw new Error(
      i18n.t("api.deleteKnowledgeDocFailed", { status: res.status })
    )
}

/** Rebuilds the vector index for a knowledge base. */
export async function reindexKnowledgeBase(kbId: string): Promise<void> {
  const res = await fetch(`/v1/knowledge/${encodeURIComponent(kbId)}/reindex`, {
    method: "POST",
    headers: langHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ??
        i18n.t("api.reindexKnowledgeFailed", { status: res.status })
    )
  }
}

/** Runs an admin search against knowledge bases. */
export async function searchKnowledge(data: {
  query: string
  kb_ids?: string[]
  top_k?: number
}): Promise<KnowledgeHit[]> {
  const res = await fetch("/v1/knowledge/search", {
    method: "POST",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ??
        i18n.t("api.searchKnowledgeFailed", { status: res.status })
    )
  }
  const body = await res.json()
  return body?.hits ?? []
}

/** Fetches embedding settings. */
export async function fetchEmbeddingConfig(): Promise<EmbeddingConfig> {
  const res = await fetch("/v1/embedding", { headers: langHeaders() })
  if (!res.ok)
    throw new Error(i18n.t("api.fetchEmbeddingFailed", { status: res.status }))
  return res.json()
}

/** Lists built-in embedding vendors. */
export async function fetchEmbeddingVendors(): Promise<EmbeddingVendorInfo[]> {
  const res = await fetch("/v1/embedding/vendors", { headers: langHeaders() })
  if (!res.ok)
    throw new Error(
      i18n.t("api.fetchEmbeddingVendorsFailed", { status: res.status })
    )
  return (await res.json()) ?? []
}

/** Saves embedding settings. */
export async function saveEmbeddingConfig(cfg: {
  vendor?: string
  backend: string
  base_url?: string
  api_key_env?: string
  model: string
  dimensions?: number
  api_key?: string
}): Promise<EmbeddingConfig> {
  const res = await fetch("/v1/embedding", {
    method: "PUT",
    headers: langHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(cfg),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(
      err?.message ?? i18n.t("api.saveEmbeddingFailed", { status: res.status })
    )
  }
  return res.json()
}
