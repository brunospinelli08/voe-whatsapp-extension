// useActivities.ts
// Feed de atividades (tabela `activities`) associadas a uma oportunidade.
// Mesma semântica do dashboard: cancelar muda status pra "cancelada";
// "enviar agora" adianta scheduled_at, o scheduler.worker pega na próxima
// passada (<=30s).

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

  const cancelActivity = useCallback(async (id: string) => {
    await voeApi.put(`/api/v1/tasks/${id}`, {
      status: 'cancelada',
      cancelled_at: new Date().toISOString(),
    })
    if (mountedRef.current) await fetchActivities()
  }, [fetchActivities])

  const sendNowActivity = useCallback(async (id: string) => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    await voeApi.put(`/api/v1/tasks/${id}`, {
      scheduled_at: now.toISOString(),
      due_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      due_time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    })
    if (mountedRef.current) await fetchActivities()
  }, [fetchActivities])

  return { activities, loading, error, refetch: fetchActivities, cancelActivity, sendNowActivity }
}
