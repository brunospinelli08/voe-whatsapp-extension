// useLeadLookup.ts
// Dado um telefone (do chat ativo do WhatsApp), busca o contato e a
// oportunidade (lead) correspondentes em /api/v1/*.
//
// Limitação conhecida: /api/v1/opportunities não tem filtro por telefone
// nem por contact_id — só por nome (search), status, stage_id, pipeline_id.
// Pra achar a oportunidade vinculada a um contato, buscamos a lista (mais
// recentes primeiro) e filtramos no cliente pelo id do contato já embutido
// em cada item (opp.contacts[].id). Funciona bem pro volume atual (extensão
// em teste com número pessoal), mas não escala pra workspaces com muitas
// oportunidades — candidato a um filtro `contact_id=` no backend no futuro.

import { useCallback, useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface LeadContact {
  id: string
  name: string | null
  phone: string | null
  phone_e164: string | null
  email: string | null
}

export interface LeadOpportunity {
  id: string
  name: string
  status: string
  stage_id: string
  stage?: { id: string; name: string } | null
  pipeline?: { id: string; name: string } | null
  contacts: LeadContact[]
}

interface LeadLookupState {
  loading: boolean
  error: string | null
  contact: LeadContact | null
  opportunity: LeadOpportunity | null
  /** true depois da primeira busca concluída (mesmo sem resultado) */
  searched: boolean
}

const initialState: LeadLookupState = {
  loading: false,
  error: null,
  contact: null,
  opportunity: null,
  searched: false,
}

export function useLeadLookup(phone: string | null) {
  const [state, setState] = useState<LeadLookupState>(initialState)

  const lookup = useCallback(async (searchPhone: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const contactsRes = await voeApi.get<{ data: LeadContact[] }>(
        `/api/v1/contacts?search=${encodeURIComponent(searchPhone)}`,
      )
      const contact = contactsRes.data[0] ?? null

      let opportunity: LeadOpportunity | null = null
      if (contact) {
        const oppsRes = await voeApi.get<{ data: LeadOpportunity[] }>(
          `/api/v1/opportunities?status=active&limit=500`,
        )
        opportunity =
          oppsRes.data.find(opp => opp.contacts.some(c => c.id === contact.id)) ?? null
      }

      setState({ loading: false, error: null, contact, opportunity, searched: true })
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : 'Erro ao buscar lead',
        contact: null,
        opportunity: null,
        searched: true,
      })
    }
  }, [])

  useEffect(() => {
    if (!phone) {
      setState(initialState)
      return
    }
    lookup(phone)
  }, [phone, lookup])

  const refetch = useCallback(() => {
    if (phone) lookup(phone)
  }, [phone, lookup])

  return { ...state, refetch }
}
