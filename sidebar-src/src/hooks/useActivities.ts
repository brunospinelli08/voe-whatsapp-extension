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
// Supabase antes de usar isso aqui.
//
// cancelActivity/sendNowActivity (fase 4 do agendamento de mensagens) via
// PUT /api/v1/tasks/[id] (endpoint já existente, aceita update parcial) —
// mesma semântica exata de cancelActivity/sendNowActivity em
// useNewActivities.ts (app.voeops.com): cancelar só muda status pra
// "cancelada" (não deleta); "enviar agora" adianta scheduled_at pra agora
// mantendo status "agendada", o scheduler.worker pega na próxima passada
// (≤30s) pelo mesmo fluxo de envio normal — não é um caminho de envio à
// parte.

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

  const cancelActivity = useCallback(async (id: string) => {
    await voeApi.put(`/api/v1/tasks/${id}`, {
      status: 'cancelada',
      cancelled_at: new Date().toISOString(),
    })
    await fetchActivities()
  }, [fetchActivities])

  const sendNowActivity = useCallback(async (id: string) => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    await voeApi.put(`/api/v1/tasks/${id}`, {
      scheduled_at: now.toISOString(),
      due_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      due_time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    })
    await fetchActivities()
  }, [fetchActivities])

  return { activities, loading, error, refetch: fetchActivities, cancelActivity, sendNowActivity }
}
