// useQualificationLabels.ts
// Labels de Qualificação por estrela (1 a 5), configuráveis por workspace —
// GET /api/v1/qualification-labels.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export function useQualificationLabels() {
  const [labels, setLabels] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    voeApi
      .get<{ data: { stars: number; label: string }[] }>('/api/v1/qualification-labels')
      .then(res => {
        if (!mounted) return
        const map: Record<number, string> = {}
        res.data.forEach(l => { map[l.stars] = l.label })
        setLabels(map)
      })
      .catch(() => { if (mounted) setLabels({}) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { labels, loading }
}
