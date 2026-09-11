import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

export function useQualificationLabels() {
  const [labels, setLabels] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    cachedFetch('qualification-labels', () =>
      voeApi.get<{ data: { stars: number; label: string }[] }>('/api/v1/qualification-labels').then(r => {
        const map: Record<number, string> = {}
        r.data.forEach(l => { map[l.stars] = l.label })
        return map
      })
    )
      .then(data => { if (mounted) setLabels(data) })
      .catch(() => { if (mounted) setLabels({}) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { labels, loading }
}
