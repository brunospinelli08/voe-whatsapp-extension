// useOpportunitiesList.ts
// Lista de oportunidades ativas do workspace, ordenada alfabeticamente por
// nome — pro select de "Vincular oportunidade" (contato já existe, mas
// ainda não está ligado a nenhuma oportunidade; a pessoa pode escolher uma
// já existente em vez de criar uma nova).
//
// Mesma chamada e mesma limitação já documentada em useLeadLookup.ts:
// /api/v1/opportunities não tem um jeito mais leve de listar (paginação
// real, busca por nome no servidor), então traz até 500 e ordena no
// client. Não escala bem pra workspaces com muitas oportunidades — mesmo
// débito técnico já registrado lá, não repetido aqui.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface OpportunityListItem {
  id: string
  name: string
}

export function useOpportunitiesList() {
  const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    voeApi
      .get<{ data: OpportunityListItem[] }>('/api/v1/opportunities?status=active&limit=500')
      .then(res => {
        if (!mounted) return
        const sorted = [...res.data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        setOpportunities(sorted)
      })
      .catch(err => {
        if (mounted) setError(err instanceof Error ? err.message : 'Erro ao buscar oportunidades')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return { opportunities, loading, error }
}
