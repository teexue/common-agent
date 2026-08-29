import { useCallback, useEffect, useRef, useState } from "react"
import { fetchProviderModelDetail } from "@/lib/api"
import type { ModelDetail } from "@/types/agent"
import { errMessage } from "./select-value"
import type { AuthStyle, StyleOption } from "./provider-form-utils"

export interface DetailQuery {
  apiStyle: StyleOption
  defaultModel: string
  name: string
  baseURL: string
  modelsPath: string
  authStyle: AuthStyle
  apiKey: string
}

function requestModelDetail(opts: {
  reqId: number
  current: { current: number }
  query: DetailQuery
  onOk: (d: ModelDetail) => void
  onErr: (msg: string) => void
  onDone: () => void
}) {
  return fetchProviderModelDetail({
    name: opts.query.name.trim() || undefined,
    api_style: opts.query.apiStyle,
    base_url: opts.query.baseURL.trim() || undefined,
    models_path: opts.query.modelsPath.trim() || undefined,
    auth_style: opts.query.authStyle || undefined,
    api_key: opts.query.apiKey.trim() || undefined,
    model: opts.query.defaultModel.trim(),
  })
    .then((d) => {
      if (opts.reqId === opts.current.current) opts.onOk(d)
    })
    .catch((e: unknown) => {
      if (opts.reqId === opts.current.current) opts.onErr(errMessage(e))
    })
    .finally(() => {
      if (opts.reqId === opts.current.current) opts.onDone()
    })
}

export function useProviderDetail(query: DetailQuery) {
  const [detail, setDetail] = useState<ModelDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailErr, setDetailErr] = useState<string | null>(null)
  const detailReqId = useRef(0)
  const detailSupported = query.apiStyle === "ollama"
  const clearDetail = useCallback(() => {
    detailReqId.current++
    setDetail(null)
    setDetailErr(null)
    setDetailLoading(false)
  }, [])
  const loadDetail = useDetailLoader(query, {
    detailSupported,
    detailReqId,
    setDetail,
    setDetailErr,
    setDetailLoading,
  })
  useEffect(() => {
    if (!detailSupported || !query.defaultModel.trim()) return
    const id = setTimeout(() => void loadDetail(), 400)
    return () => clearTimeout(id)
  }, [detailSupported, query.defaultModel, loadDetail])
  return {
    detail,
    detailLoading,
    detailErr,
    detailSupported,
    detailEmpty: !query.defaultModel.trim(),
    clearDetail,
    loadDetail,
  }
}

function startDetailLoad(
  query: DetailQuery,
  extra: {
    detailSupported: boolean
    detailReqId: { current: number }
    setDetail: (d: ModelDetail | null) => void
    setDetailErr: (e: string | null) => void
    setDetailLoading: (v: boolean) => void
  }
) {
  if (!extra.detailSupported || !query.defaultModel.trim()) return
  const reqId = ++extra.detailReqId.current
  extra.setDetailLoading(true)
  extra.setDetailErr(null)
  return requestModelDetail({
    reqId,
    current: extra.detailReqId,
    query,
    onOk: (d) => extra.setDetail(d),
    onErr: (msg) => {
      extra.setDetailErr(msg)
      extra.setDetail(null)
    },
    onDone: () => extra.setDetailLoading(false),
  })
}

function useDetailLoader(
  query: DetailQuery,
  extra: {
    detailSupported: boolean
    detailReqId: { current: number }
    setDetail: (d: ModelDetail | null) => void
    setDetailErr: (e: string | null) => void
    setDetailLoading: (v: boolean) => void
  }
) {
  const {
    apiStyle,
    defaultModel,
    name,
    baseURL,
    modelsPath,
    authStyle,
    apiKey,
  } = query
  const {
    detailSupported,
    detailReqId,
    setDetail,
    setDetailErr,
    setDetailLoading,
  } = extra
  return useCallback(() => {
    return startDetailLoad(
      { apiStyle, defaultModel, name, baseURL, modelsPath, authStyle, apiKey },
      {
        detailSupported,
        detailReqId,
        setDetail,
        setDetailErr,
        setDetailLoading,
      }
    )
  }, [
    detailSupported,
    apiStyle,
    defaultModel,
    name,
    baseURL,
    modelsPath,
    authStyle,
    apiKey,
    detailReqId,
    setDetail,
    setDetailErr,
    setDetailLoading,
  ])
}
