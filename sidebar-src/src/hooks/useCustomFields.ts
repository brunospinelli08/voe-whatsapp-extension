import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

export interface CustomFieldDef {
  id: string
  field_for: string
  label: string
  type: 'text' | 'number' | 'date' | 'option' | 'multiple_choice' | 'checkbox' | string
  field_order: number
  required: boolean
  options: string[] | null
}

export function useCustomFields(fieldFor: 'deal' | 'contact' | 'company' | 'unit') {
  const [fields, setFields] = useState<CustomFieldDef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    cachedFetch(`custom-fields:${fieldFor}`, () => voeApi.get<{ data: CustomFieldDef[] }>(`/api/v1/custom-fields?for=${fieldFor}`).then(r => r.data))
      .then(data => { if (mounted) setFields(data) })
      .catch(() => { if (mounted) setFields([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [fieldFor])

  return { fields, loading }
}
