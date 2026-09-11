import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

export interface SegmentFieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'select' | 'multiselect' | 'boolean' | string
  required: boolean
  options?: string[]
}

export function useSegmentFields() {
  const [fields, setFields] = useState<SegmentFieldDef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    cachedFetch('segment-fields', () => voeApi.get<{ data: SegmentFieldDef[] }>('/api/v1/segment-fields').then(r => r.data))
      .then(data => { if (mounted) setFields(data) })
      .catch(() => { if (mounted) setFields([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { fields, loading }
}
