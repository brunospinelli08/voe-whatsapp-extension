import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

export interface PipelineStageOption {
  id: string
  name: string
  order: number
}

export interface PipelineOption {
  id: string
  name: string
  is_default: boolean
  pipeline_stages: PipelineStageOption[]
}

export function usePipelines() {
  const [pipelines, setPipelines] = useState<PipelineOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    cachedFetch('pipelines', () => voeApi.get<{ data: PipelineOption[] }>('/api/v1/pipelines').then(r => r.data))
      .then(data => { if (mounted) setPipelines(data) })
      .catch(() => { if (mounted) setPipelines([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { pipelines, loading }
}
