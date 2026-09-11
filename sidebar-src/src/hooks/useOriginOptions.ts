import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

export interface OriginOption {
  id: string
  label: string
}

export function useOriginOptions() {
  const [origins, setOrigins] = useState<OriginOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    cachedFetch('origin-options', () => voeApi.get<{ data: OriginOption[] }>('/api/v1/origin-options').then(r => r.data))
      .then(data => { if (mounted) setOrigins(data) })
      .catch(() => { if (mounted) setOrigins([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { origins, loading }
}
