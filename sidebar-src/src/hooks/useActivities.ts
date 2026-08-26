// useActivities.ts
// Feed de atividades (tabela `activities` do app.voeops.com — visitas,
// reuniões, tarefas, WhatsApp agendado) associadas a uma oportunidade.
// Diferente das anotações que a extensão já cria (contact_events, via
// NotesForm) — é o mesmo feed que aparece na aba "Atividades" da tela real
// de Oportunidades no dashboard.
//
// Nota de nomenclatura do próprio backend: o endpoint chamado
// /api/v1/activities na verdade escreve em contact_events (rota legada,
// ver comentário no arquivo). É /api/v1/tasks que lê/escreve na tabela
// `activities` de verdade — confirmado batendo com o schema real do
// Supabase antes de usar isso aqui. Só leitura por enquanto.

import { useCallback, useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface Activity {
  id: string
  type: 'task' | 'whatsapp' | 'call' | 'email' | 'meeting' | 'visit' | string
  title: string | null
  description: string | null
  status: string
  due_date: string | null
  due_time: string | null
  scheduled_at: string | null
  completed_at: string | null
  result: string | null
}

export function useActivities(opportunityId: string | null) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = useCallback(async () => {
    if (!opportunityId) {
      setActivities([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await voeApi.get<{ data: Activity[] }>(
        `/api/v1/tasks?opportunity_id=${opportunityId}`,
      )
      setActivities(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar atividades')
    } finally {
      setLoading(false)
    }
  }, [opportunityId])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  return { activities, loading, error, refetch: fetchActivities }
}
