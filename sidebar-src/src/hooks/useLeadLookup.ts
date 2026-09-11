// useLeadLookup.ts
// Dado um telefone (do chat ativo do WhatsApp), busca o contato e a
// oportunidade em uma unica chamada via GET /api/v1/lead-context?phone=X.

import { useCallback, useEffect, useRef, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { normalizeToE164 } from '../lib/phoneUtils'
import { getLeadFromCache, setLeadInCache, invalidateLeadCache } from '../lib/leadCache'
import { invalidateCacheByPrefix } from '../lib/configCache'

export interface LeadContact {
  id: string
  name: string | null
  phone: string | null
  phone_e164: string | null
  email: string | null
  tags?: string[] | null
  contact_type?: 'lead' | 'cliente' | 'parceiro' | 'fornecedor' | 'outro' | null
  role_title?: string | null
  company_id?: string | null
  company?: { id: string; name: string } | null
}

export interface LeadOpportunity {
  id: string
  name: string
  status: string
  stage_id: string
  stage?: { id: string; name: string } | null
  pipeline?: { id: string; name: string } | null
  lost_reason: string | null
  contacts: LeadContact[]
  total_value?: number
  company?: { id: string; name: string } | null
  owner?: { id: string; name: string } | null
  lead_score?: number | null
}

interface LeadContextResponse {
  contact: LeadContact | null
  opportunities: LeadOpportunity[]
}

interface LeadLookupState {
  loading: boolean
  revalidating: boolean
  error: string | null
  contact: LeadContact | null
  opportunity: LeadOpportunity | null
  searched: boolean
}

const initialState: LeadLookupState = {
  loading: false,
  revalidating: false,
  error: null,
  contact: null,
  opportunity: null,
  searched: false,
}

export function useLeadLookup(phone: string | null) {
  const [state, setState] = useState<LeadLookupState>(initialState)
  const mountedRef = useRef(true)
  const phoneRef = useRef(phone)
  phoneRef.current = phone

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const lookup = useCallback(async (searchPhone: string, isRefetch: boolean) => {
    if (isRefetch) {
      setState(s => ({ ...s, revalidating: true, error: null }))
    } else {
      setState(s => ({ ...s, loading: true, error: null }))
    }

    try {
      const normalized = normalizeToE164(searchPhone)
      const searchTerm = normalized ?? searchPhone

      // Uma unica chamada retorna contato + oportunidades vinculadas
      const res = await voeApi.get<LeadContextResponse>(
        `/api/v1/lead-context?phone=${encodeURIComponent(searchTerm)}`,
      )
      if (!mountedRef.current) return

      const contact = res.contact
      // Prioriza oportunidade ativa; se nao houver, pega a mais recente
      const opportunity = res.opportunities.find(o => o.status === 'active')
        ?? res.opportunities[0]
        ?? null

      setLeadInCache(searchPhone, contact, opportunity)
      setState({ loading: false, revalidating: false, error: null, contact, opportunity, searched: true })
    } catch (err) {
      if (!mountedRef.current) return
      setState(s => ({
        ...(isRefetch ? s : {}),
        loading: false,
        revalidating: false,
        error: err instanceof Error ? err.message : 'Erro ao buscar lead',
        contact: isRefetch ? s.contact : null,
        opportunity: isRefetch ? s.opportunity : null,
        searched: true,
      }))
    }
  }, [])

  useEffect(() => {
    if (!phone) {
      setState(initialState)
      return
    }

    const cached = getLeadFromCache(phone)
    if (cached) {
      setState({
        loading: false,
        revalidating: true,
        error: null,
        contact: cached.contact,
        opportunity: cached.opportunity,
        searched: true,
      })
      lookup(phone, true)
    } else {
      lookup(phone, false)
    }
  }, [phone, lookup])

  const refetch = useCallback(() => {
    if (phone) lookup(phone, true)
  }, [phone, lookup])

  const invalidateAndRefetch = useCallback(() => {
    if (phone) {
      invalidateLeadCache(phone)
      if (state.opportunity) {
        invalidateCacheByPrefix(`opp-detail:${state.opportunity.id}`)
      }
    }
    refetch()
  }, [phone, state.opportunity, refetch])

  // Revalidar ao recuperar foco
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && phoneRef.current) {
        lookup(phoneRef.current, true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [lookup])

  return { ...state, refetch, invalidateAndRefetch }
}
