import { useEffect } from "react"
import type { ModelInfo } from "@/types/agent"
import {
  visionFromCapabilities,
  visionFromFetchedModels,
} from "@/lib/provider-models"

export function useSyncProviderVision(opts: {
  setVision: (v: boolean) => void
  models: ModelInfo[] | null
  fetching?: boolean
  defaultModel: string
  capabilities?: string[]
}) {
  const { setVision, models, fetching, defaultModel, capabilities } = opts
  useEffect(() => {
    if (fetching) return
    const fromCaps = visionFromCapabilities(capabilities)
    if (fromCaps !== undefined) {
      setVision(fromCaps)
      return
    }
    const fromList = visionFromFetchedModels(models, defaultModel)
    if (fromList !== undefined) setVision(fromList)
  }, [setVision, models, fetching, defaultModel, capabilities])
}
