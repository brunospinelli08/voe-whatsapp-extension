// useOpportunityDetail.ts
// Registro completo de UMA oportunidade — GET /api/v1/opportunities/:id
// (endpoint que já existia, mas cujo retorno não tinha `segment_data` nem
// `unit_id`; adicionado em app.voeops.com nesta rodada, ver route.ts).
// Diferente de useLeadLookup (que só acha o id certo buscando na lista),
// este hook é quem alimenta o painel de Contexto com todos os campos —
// Lead Score, Qualificação, Orçamento, Valor total, Origem, Campanha,
// campos personalizados, campos de segmento, datas — espelhando
// ContextPanel.tsx campo a campo.

import { useCallback, useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

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
  /** Valores dos campos nativos do segmento do workspace (chave = SegmentFieldDef.key). */
  segment_data: Record<string, string | string[] | boolean>
  /** Unidade/espaço vinculado — só usado hoje no fluxo de marcar Vendido no
   * dashboard real; não é exibido como campo no painel de Contexto (ver
   * ContextPanel.tsx — unit_id só aparece dentro do WonLostModal). */
  unit_id: string | null
  pipeline: { id: string; name: string } | null
  stage: { id: string; name: string; color: string; order: number } | null
  company: { id: string; name: string } | null
  contacts: { id: string; name: string | null; phone: string | null; role: string | null; is_primary: boolean }[]
  custom_fields: OpportunityCustomFieldValue[]
}

export function useOpportunityDetail(opportunityId: string | null) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!opportunityId) {
      setDetail(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await voeApi.get<{ data: OpportunityDetail }>(`/api/v1/opportunities/${opportunityId}`)
      // Defensivo: enquanto o PR que adiciona segment_data/unit_id em
      // app.voeops.com não estiver mergeado e deployado, a API de produção
      // ainda responde sem essas duas chaves — sem isso aqui, qualquer
      // workspace com campos de segmento (ex: Espaço de Eventos) quebra em
      // runtime ao tentar ler detail.segment_data[key].
      setDetail({ ...res.data, segment_data: res.data.segment_data ?? {}, unit_id: res.data.unit_id ?? null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar oportunidade')
    } finally {
      setLoading(false)
    }
  }, [opportunityId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  /** Atualiza um ou mais campos nativos da oportunidade (PUT genérico, já
   * existente). Otimista: reflete localmente antes da resposta, e reverte
   * se a chamada falhar. */
  const patch = useCallback(
    async (fields: Partial<Pick<OpportunityDetail,
      'name' | 'origin_id' | 'campaign_id' | 'qualification_score' | 'estimated_budget'
    >>) => {
      if (!opportunityId) return
      setDetail(prev => (prev ? { ...prev, ...fields } : prev))
      try {
        await voeApi.put(`/api/v1/opportunities/${opportunityId}`, fields)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar')
        fetchDetail()
      }
    },
    [opportunityId, fetchDetail],
  )

  /** Atualiza UM campo dentro de segment_data — faz o merge no cliente
   * antes de enviar, porque o PUT substitui a coluna inteira (não é um
   * merge de JSONB no backend). */
  const patchSegmentField = useCallback(
    async (key: string, value: string | string[] | boolean) => {
      if (!opportunityId || !detail) return
      const nextSegmentData = { ...detail.segment_data, [key]: value }
      setDetail(prev => (prev ? { ...prev, segment_data: nextSegmentData } : prev))
      try {
        await voeApi.put(`/api/v1/opportunities/${opportunityId}`, { segment_data: nextSegmentData })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar')
        fetchDetail()
      }
    },
    [opportunityId, detail, fetchDetail],
  )

  return { detail, loading, error, refetch: fetchDetail, patch, patchSegmentField }
}
