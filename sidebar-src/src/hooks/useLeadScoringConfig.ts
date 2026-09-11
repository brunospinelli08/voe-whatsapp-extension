import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

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
    cachedFetch('lead-scoring-config', () =>
      voeApi.get<{ data: { is_active: boolean; bands: ScoreBand[] } }>('/api/v1/lead-scoring-config').then(r => r.data)
    )
      .then(data => {
        if (!mounted) return
        setIsActive(data.is_active)
        setBands(data.bands)
      })
      .catch(() => { if (mounted) setIsActive(false) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { isActive, bands, loading }
}
