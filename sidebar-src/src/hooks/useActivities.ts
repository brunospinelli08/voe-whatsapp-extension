// useActivities.ts
// Feed de atividades (tabela `activities`) associadas a uma oportunidade.
// Mesmas mutações de useNewActivities.ts no dashboard (concluir com
// resultado, cancelar, reativar, adiar, excluir, enviar agora), só que via
// /api/v1/tasks em vez do supabase-js direto. "Enviar agora" adianta
// scheduled_at — o scheduler.worker pega na próxima passada (<=30s).

import { useCallback, useEffect, useRef, useState } from 'react'
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
  metadata: Record<string, unknown> | null
}

/** Igual a computeScheduledAt() do dashboard: WhatsApp/E-mail disparam por
 * scheduled_at, então adiar precisa mover ele junto (senão dispara no
 * horário antigo). */
function computeScheduledAt(type: string | undefined, dueDate: string, dueTime: string | null): string | null {
  if (type !== 'whatsapp' && type !== 'email') return null
  const t = (dueTime ?? '09:00').slice(0, 5)
  return new Date(`${dueDate}T${t}:00`).toISOString()
}

export function useActivities(opportunityId: string | null) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

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
      if (!mountedRef.current) return
      setActivities(res.data)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Erro ao buscar atividades')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [opportunityId])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  /** PUT + aplica o mesmo patch no estado local (sem piscar o spinner). */
  const update = useCallback(async (id: string, fields: Partial<Activity> & Record<string, unknown>) => {
    await voeApi.put(`/api/v1/tasks/${id}`, fields)
    if (!mountedRef.current) return
    setActivities(prev => prev.map(a => (a.id === id ? { ...a, ...fields } : a)))
  }, [])

  const completeActivity = useCallback(async (id: string, result: string) => {
    await update(id, { status: 'concluida', result, completed_at: new Date().toISOString() })
  }, [update])

  const cancelActivity = useCallback(async (id: string) => {
    await update(id, { status: 'cancelada', cancelled_at: new Date().toISOString() })
  }, [update])

  /** Volta pra "agendada" limpando resultado/datas de conclusão. */
  const reactivateActivity = useCallback(async (id: string) => {
    await update(id, { status: 'agendada', result: null, completed_at: null, cancelled_at: null })
  }, [update])

  const postponeActivity = useCallback(async (id: string, newDate: string, newTime: string | null) => {
    const current = activities.find(a => a.id === id)
    const fields: Partial<Activity> = { due_date: newDate }
    if (newTime !== null) fields.due_time = newTime
    const scheduledAt = computeScheduledAt(current?.type, newDate, newTime ?? current?.due_time ?? null)
    if (scheduledAt) fields.scheduled_at = scheduledAt
    await update(id, fields)
  }, [activities, update])

  const deleteActivity = useCallback(async (id: string) => {
    await voeApi.delete(`/api/v1/tasks/${id}`)
    if (mountedRef.current) setActivities(prev => prev.filter(a => a.id !== id))
  }, [])

  const sendNowActivity = useCallback(async (id: string) => {
    // O dashboard filtra .eq('status', 'agendada') no update; a API não tem
    // esse filtro, então confere antes de adiantar.
    if (activities.find(a => a.id === id)?.status !== 'agendada') return
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    await update(id, {
      scheduled_at: now.toISOString(),
      due_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      due_time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    })
  }, [activities, update])

  return {
    activities, loading, error, refetch: fetchActivities,
    completeActivity, cancelActivity, reactivateActivity, postponeActivity, deleteActivity, sendNowActivity,
  }
}
