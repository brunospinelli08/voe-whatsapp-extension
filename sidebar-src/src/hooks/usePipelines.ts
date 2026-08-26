// usePipelines.ts
// Funis (pipelines) do workspace, cada um com suas etapas — GET /api/v1/pipelines.
// Usado pro seletor de Funil (chips) + Etapa do formulário de Nova Oportunidade.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

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
    voeApi
      .get<{ data: PipelineOption[] }>('/api/v1/pipelines')
      .then(res => { if (mounted) setPipelines(res.data) })
      .catch(() => { if (mounted) setPipelines([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { pipelines, loading }
}
