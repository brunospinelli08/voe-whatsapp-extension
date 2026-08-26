// LinkExistingOpportunityForm.tsx
// Vincula o contato ativo a uma oportunidade JÁ EXISTENTE (select com as
// oportunidades ativas do workspace, em ordem alfabética) — em vez de criar
// uma oportunidade nova. Usa o mesmo endpoint de vínculo já existente
// (POST /api/v1/opportunities/:id/contacts).

import { FormEvent, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { useOpportunitiesList } from '../hooks/useOpportunitiesList'
import { Spinner } from './Spinner'

interface Props {
  contactId: string
  onLinked: () => void
  onCancel: () => void
}

export function LinkExistingOpportunityForm({ contactId, onLinked, onCancel }: Props) {
  const { opportunities, loading, error: loadError } = useOpportunitiesList()
  const [opportunityId, setOpportunityId] = useState('')
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!opportunityId) {
      setError('Selecione uma oportunidade.')
      return
    }
    setLinking(true)
    setError(null)
    try {
      await voeApi.post(`/api/v1/opportunities/${opportunityId}/contacts`, {
        contact_id: contactId,
      })
      onLinked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao vincular oportunidade')
    } finally {
      setLinking(false)
    }
  }

  if (loading) return <Spinner label="Carregando oportunidades…" />

  return (
    <form className="save-contact-form" onSubmit={handleSubmit}>
      {loadError && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{loadError}</span>
        </div>
      )}
      {!loadError && opportunities.length === 0 && (
        <p className="muted">Nenhuma oportunidade ativa nesse workspace ainda.</p>
      )}
      {opportunities.length > 0 && (
        <label>
          Oportunidade
          <select value={opportunityId} onChange={e => setOpportunityId(e.target.value)} autoFocus>
            <option value="">— selecione —</option>
            {opportunities.map(opp => (
              <option key={opp.id} value={opp.id}>
                {opp.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="create-opportunity-form-actions">
        <button type="submit" disabled={linking || opportunities.length === 0}>
          {linking ? 'Vinculando…' : 'Vincular'}
        </button>
        <button type="button" className="secondary" disabled={linking} onClick={onCancel}>
          Cancelar
        </button>
      </div>
      {error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </form>
  )
}
