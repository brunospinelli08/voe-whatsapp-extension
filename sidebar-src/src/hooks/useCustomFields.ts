// useCustomFields.ts
// Definições de campos personalizados do workspace para oportunidades
// (custom_fields, field_for='deal'), via GET /api/v1/custom-fields?for=deal
// — endpoint novo, criado especificamente pra isso (o que já existia,
// /api/v1/opportunities/[id]/custom-fields, só lida com valores de uma
// oportunidade já criada). Usado pra montar o formulário de Nova
// Oportunidade dinamicamente, igual o dashboard faz.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface CustomFieldDef {
  id: string
  field_for: string
  label: string
  /** Valores reais da coluna `type` no banco — não são os mesmos nomes da UI de configurações. */
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

    voeApi
      .get<{ data: CustomFieldDef[] }>(`/api/v1/custom-fields?for=${fieldFor}`)
      .then(res => {
        if (mounted) setFields(res.data)
      })
      .catch(() => {
        // Best-effort — se falhar, o formulário simplesmente não mostra
        // campos personalizados, mas os campos fixos continuam funcionando.
        if (mounted) setFields([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [fieldFor])

  return { fields, loading }
}
