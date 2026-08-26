// OpportunityCard.tsx
// Card resumido da oportunidade encontrada: nome, status, empresa,
// responsável, valor, e dois atalhos — "Adicionar contato à oportunidade"
// (quando o contato do chat ativo ainda não está vinculado a ela — ex:
// oportunidade de empresa com vários contatos) e "Abrir na VOE" (deep link
// direto pra página real da oportunidade no dashboard).

import { useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { VOE_API_BASE } from '../config'
import type { LeadContact, LeadOpportunity } from '../hooks/useLeadLookup'

// Nomenclatura confirmada contra o dashboard real (KanbanCard.tsx,
// ContextPanel.tsx): "Vendido", não "Ganho" — RD Station usa "Ganho", a VOE não.
const STATUS_LABELS: Record<string, string> = {
  active: 'Em andamento',
  won: 'Vendido',
  lost: 'Perdido',
  paused: 'Pausado',
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  opportunity: LeadOpportunity
  /** Contato do chat ativo (achado por telefone) — pode já estar entre os contacts da oportunidade, ou não. */
  activeContact: LeadContact | null
  onLinked: () => void
}

export function OpportunityCard({ opportunity, activeContact, onLinked }: Props) {
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const alreadyLinked =
    !activeContact || opportunity.contacts.some(c => c.id === activeContact.id)

  async function handleAddContact() {
    if (!activeContact) return
    setLinking(true)
    setLinkError(null)
    try {
      await voeApi.post(`/api/v1/opportunities/${opportunity.id}/contacts`, {
        contact_id: activeContact.id,
      })
      onLinked()
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Erro ao vincular contato')
    } finally {
      setLinking(false)
    }
  }

  function handleOpenInVoe() {
    window.open(`${VOE_API_BASE}/deals/${opportunity.id}`, '_blank', 'noopener')
  }

  return (
    <div className="card opportunity-card">
      <h2>{opportunity.name}</h2>

      <div className="opportunity-meta">
        <span className={`status-badge status-${opportunity.status}`}>
          {STATUS_LABELS[opportunity.status] ?? opportunity.status}
        </span>
        {opportunity.pipeline && <span className="muted">{opportunity.pipeline.name}</span>}
      </div>

      <dl className="opportunity-summary">
        {opportunity.company && (
          <div>
            <dt>Empresa</dt>
            <dd>{opportunity.company.name}</dd>
          </div>
        )}
        {opportunity.owner && (
          <div>
            <dt>Responsável</dt>
            <dd>{opportunity.owner.name}</dd>
          </div>
        )}
        {typeof opportunity.total_value === 'number' && opportunity.total_value > 0 && (
          <div>
            <dt>Valor</dt>
            <dd>{formatBRL(opportunity.total_value)}</dd>
          </div>
        )}
      </dl>

      {opportunity.status === 'lost' && opportunity.lost_reason && (
        <p className="muted">Motivo: {opportunity.lost_reason}</p>
      )}

      <div className="opportunity-card-actions">
        {!alreadyLinked && (
          <button className="secondary" disabled={linking} onClick={handleAddContact}>
            {linking ? 'Vinculando…' : 'Adicionar contato à oportunidade'}
          </button>
        )}
        <button className="secondary" onClick={handleOpenInVoe}>
          Abrir na VOE
        </button>
      </div>
      {linkError && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{linkError}</span>
        </div>
      )}
    </div>
  )
}
