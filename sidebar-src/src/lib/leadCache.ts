// leadCache.ts
// Cache de atendimentos recentes — evita refetch ao voltar de B para A.
// Chave: telefone canonico (E.164). TTL curto (60s) para nao mostrar
// dados muito defasados.
//
// O cache guarda contato + oportunidade. Ao voltar para um chat ja
// visitado, os dados aparecem imediatamente enquanto o refetch roda
// em background (stale-while-revalidate).

import type { LeadContact, LeadOpportunity } from '../hooks/useLeadLookup'

interface LeadCacheEntry {
  contact: LeadContact | null
  opportunity: LeadOpportunity | null
  fetchedAt: number
}

const LEAD_TTL_MS = 60_000 // 1 minuto
const MAX_ENTRIES = 20

const cache = new Map<string, LeadCacheEntry>()

export function getLeadFromCache(phone: string): LeadCacheEntry | null {
  const entry = cache.get(phone)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > LEAD_TTL_MS) {
    cache.delete(phone)
    return null
  }
  return entry
}

export function setLeadInCache(
  phone: string,
  contact: LeadContact | null,
  opportunity: LeadOpportunity | null,
): void {
  // Limita o tamanho do cache (FIFO)
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(phone, { contact, opportunity, fetchedAt: Date.now() })
}

/** Invalida um telefone especifico (ex: apos criar contato). */
export function invalidateLeadCache(phone: string): void {
  cache.delete(phone)
}

/** Limpa tudo (ex: logout ou troca de workspace). */
export function clearLeadCache(): void {
  cache.clear()
}
