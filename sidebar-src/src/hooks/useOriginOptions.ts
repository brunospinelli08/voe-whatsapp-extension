// useOriginOptions.ts
// Opções de "Origem" (origin_options) configuradas no workspace, via
// GET /api/v1/origin-options — endpoint novo. Nomenclatura confirmada
// contra o dashboard real: é "Origem", não "Fonte" (termo do RD Station).

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface OriginOption {
  id: string
  label: string
}

export function useOriginOptions() {
  const [origins, setOrigins] = useState<OriginOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)

    voeApi
      .get<{ data: OriginOption[] }>('/api/v1/origin-options')
      .then(res => {
        if (mounted) setOrigins(res.data)
      })
      .catch(() => {
        if (mounted) setOrigins([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return { origins, loading }
}
