// useSegmentFields.ts
// Campos nativos do segmento do workspace (ex: "Tipo de evento" pra
// espaco_de_eventos) — GET /api/v1/segment-fields. Diferente de
// useCustomFields: este é o preset fixo do segmento escolhido no
// onboarding, não configurável manualmente.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

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
    voeApi
      .get<{ data: SegmentFieldDef[] }>('/api/v1/segment-fields')
      .then(res => { if (mounted) setFields(res.data) })
      .catch(() => { if (mounted) setFields([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { fields, loading }
}
