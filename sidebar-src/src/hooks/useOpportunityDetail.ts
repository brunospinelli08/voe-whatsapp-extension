// useOpportunityDetail.ts
// Registro completo de UMA oportunidade — GET /api/v1/opportunities/:id
// Com cache em memória (TTL 60s) para retorno instantâneo ao revisitar.

import { useCallback, useEffect, useRef, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch, invalidateCache } from '../lib/configCache'

export interface OpportunityCustomFieldValue {
  id: string
  label: string
  type: string
  value: string | null
}

export interface OpportunityDetail {
  id: string
  name: string
  status: string
  created_at: string
  closed_at: string | null
  owner: { id: string; name: string } | null
  origin_id: string | null
  campaign_id: string | null
  total_value: number
  estimated_budget: number | null
  qualification_score: number | null
  lead_score: number | null
  lost_reason: string | null
  paused_reason: string | null
  segment_data: Record<string, string | string[] | boolean>
  /** false quando a API não devolveu segment_data (versão antiga do
   * GET /api/v1/opportunities/:id) — aí não dá pra editar um campo sem
   * apagar os outros, já que o PUT regrava o JSON inteiro. */
  segment_data_loaded: boolean
  unit_id: string | null
  pipeline: { id: string; name: string } | null
  stage: { id: string; name: string; color: string; order: number } | null
  company: { id: string; name: string } | null
  contacts: { id: string; name: string | null; phone: string | null; role: string | null; is_primary: boolean }[]
  custom_fields: OpportunityCustomFieldValue[]
}

const OPP_CACHE_TTL = 60_000 // 1 minuto

function oppCacheKey(id: string) { return `opp-detail:${id}` }

export function useOpportunityDetail(opportunityId: string | null) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchDetail = useCallback(async () => {
    if (!opportunityId) {
      setDetail(null)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Se ja tem detail (cache ou estado anterior), nao mostra loading
    setLoading(prev => detail === null ? true : prev)
    setError(null)

    try {
      const data = await cachedFetch(
        oppCacheKey(opportunityId),
        async () => {
          const res = await voeApi.get<{ data: OpportunityDetail }>(`/api/v1/opportunities/${opportunityId}`)
          return {
            ...res.data,
            segment_data: res.data.segment_data ?? {},
            segment_data_loaded: res.data.segment_data != null,
            unit_id: res.data.unit_id ?? null,
          }
        },
        OPP_CACHE_TTL,
      )
      if (controller.signal.aborted || !mountedRef.current) return
      setDetail(data)
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Erro ao carregar oportunidade')
    } finally {
      if (!controller.signal.aborted && mountedRef.current) {
        setLoading(false)
      }
    }
  }, [opportunityId, detail])

  useEffect(() => {
    fetchDetail()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId])

  /** Invalida cache e rebusca. */
  const refetch = useCallback(async () => {
    if (opportunityId) invalidateCache(oppCacheKey(opportunityId))
    await fetchDetail()
  }, [opportunityId, fetchDetail])

  const patch = useCallback(
    async (fields: Partial<Pick<OpportunityDetail,
      'name' | 'origin_id' | 'campaign_id' | 'qualification_score' | 'estimated_budget'
    >>) => {
      if (!opportunityId) return
      setDetail(prev => (prev ? { ...prev, ...fields } : prev))
      // Invalida cache apos edicao
      invalidateCache(oppCacheKey(opportunityId))
      try {
        await voeApi.put(`/api/v1/opportunities/${opportunityId}`, fields)
      } catch (err) {
        if (!mountedRef.current) return
        setError(err instanceof Error ? err.message : 'Erro ao salvar')
        refetch()
      }
    },
    [opportunityId, refetch],
  )

  const patchSegmentField = useCallback(
    async (key: string, value: string | string[] | boolean) => {
      if (!opportunityId || !detail) return
      if (!detail.segment_data_loaded) {
        setError('Não foi possível carregar os campos do segmento. Atualize e tente de novo.')
        return
      }
      const nextSegmentData = { ...detail.segment_data, [key]: value }
      setDetail(prev => (prev ? { ...prev, segment_data: nextSegmentData } : prev))
      invalidateCache(oppCacheKey(opportunityId))
      try {
        await voeApi.put(`/api/v1/opportunities/${opportunityId}`, { segment_data: nextSegmentData })
      } catch (err) {
        if (!mountedRef.current) return
        setError(err instanceof Error ? err.message : 'Erro ao salvar')
        refetch()
      }
    },
    [opportunityId, detail, refetch],
  )

  return { detail, loading, error, refetch, patch, patchSegmentField }
}
