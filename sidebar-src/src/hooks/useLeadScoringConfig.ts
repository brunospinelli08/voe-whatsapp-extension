// useLeadScoringConfig.ts
// Diz se o Lead Score deve aparecer (feature de plano Scale/Enterprise —
// GET /api/v1/lead-scoring-config já resolve o gate de plano + a config do
// workspace) e as faixas de temperatura configuradas.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface ScoreBand {
  min: number
  max: number
  label: string
  color: string
}

export function useLeadScoringConfig() {
  const [isActive, setIsActive] = useState(false)
  const [bands, setBands] = useState<ScoreBand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    voeApi
      .get<{ data: { is_active: boolean; bands: ScoreBand[] } }>('/api/v1/lead-scoring-config')
      .then(res => {
        if (!mounted) return
        setIsActive(res.data.is_active)
        setBands(res.data.bands)
      })
      .catch(() => {
        if (mounted) setIsActive(false)
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { isActive, bands, loading }
}
