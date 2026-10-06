// useWhatsAppTracks.ts
// Trilhas de WhatsApp ativas do workspace (com os passos) — GET
// /api/v1/whatsapp-tracks, a mesma consulta do WhatsAppTrackBuilder do
// dashboard. Só leitura: trilha se cria/edita em Configurações → Conversas →
// Trilha de WhatsApp. `refetch` ignora o cache (botão "Atualizar", pra quem
// acabou de criar uma trilha lá).
//
// trackStepDate/toDateKey: réplica de lib/whatsapp/trackSchedule.ts do
// dashboard — data real de cada passo a partir do D+X, em dias úteis quando a
// trilha pede (nunca cai em sábado/domingo; mesma regra do backend).

import { useCallback, useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch, invalidateCache } from '../lib/configCache'

export interface WhatsAppTrackStep {
  id: string
  position: number
  /** Dias após o início da trilha (D+0, D+2...) */
  day_offset: number
  /** HH:MM(:SS) */
  time: string | null
  title: string
  message: string
  /** Mensagem de origem na Central de Mensagens, se veio de lá */
  message_library_id: string | null
}

export interface WhatsAppTrack {
  id: string
  name: string
  description: string | null
  /** true = D+X conta só dias úteis (seg–sex) */
  business_days_only: boolean | null
  whatsapp_track_steps: WhatsAppTrackStep[]
}

const CACHE_KEY = 'whatsapp-tracks'

export function useWhatsAppTracks(enabled: boolean) {
  const [tracks, setTracks] = useState<WhatsAppTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    if (force) invalidateCache(CACHE_KEY)
    setLoading(true)
    setError(null)
    try {
      const data = await cachedFetch(CACHE_KEY, () => voeApi.get<{ data: WhatsAppTrack[] }>('/api/v1/whatsapp-tracks').then(r => r.data), 60_000)
      setTracks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar trilhas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (enabled) void load() }, [enabled, load])

  return { tracks, loading, error, refetch: () => load(true) }
}

function isWeekend(d: Date) {
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

/** Date (meia-noite local) de `from` + `days` — corridos ou úteis. */
export function trackStepDate(days: number, businessDaysOnly: boolean, from: Date = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const n = Math.max(0, Math.floor(days))
  if (!businessDaysOnly) {
    d.setDate(d.getDate() + n)
    return d
  }
  let remaining = n
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    if (!isWeekend(d)) remaining--
  }
  while (isWeekend(d)) d.setDate(d.getDate() + 1)
  return d
}

/** "YYYY-MM-DD" (hora local) — formato de activities.due_date. */
export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
