// AssociateCompanyModal.tsx
// Busca uma empresa JÁ EXISTENTE no workspace (GET /api/v1/companies?search=,
// já existia) e vincula ao contato atual (PUT /api/v1/contacts/:id,
// genérico, já existia) — sem criar nada novo. Reaproveita SearchSelect.tsx,
// o mesmo componente de busca-e-selecione já usado em CompanySection.tsx.

import { useCallback, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import type { LeadContact } from '../hooks/useLeadLookup'
import { SearchSelect, type SearchableItem } from './SearchSelect'
import { XIcon } from './Icons'

interface Props {
  contact: LeadContact
  onClose: () => void
  onLinked: () => void
}

export function AssociateCompanyModal({ contact, onClose, onLinked }: Props) {
  const [selected, setSelected] = useState<SearchableItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCompanies = useCallback(async (query: string) => {
    const res = await voeApi.get<{ data: { id: string; name: string }[] }>(
      `/api/v1/companies?search=${encodeURIComponent(query)}`,
    )
    return res.data.map(c => ({ id: c.id, name: c.name }))
  }, [])

  async function handleConfirm() {
    if (!selected?.id) return
    setSaving(true)
    setError(null)
    try {
      await voeApi.put(`/api/v1/contacts/${contact.id}`, { company_id: selected.id })
      onLinked()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao associar empresa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="activity-modal-backdrop" onClick={onClose}>
      <div className="activity-modal" onClick={e => e.stopPropagation()}>
        <div className="activity-modal-header">
          <h3>Associar empresa</h3>
          <button type="button" className="activity-modal-close" onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <div className="activity-modal-body">
          <SearchSelect
            fetchItems={fetchCompanies}
            selected={selected}
            onSelect={item => setSelected(item.id ? item : null)}
            placeholder="Buscar empresa por nome..."
          />

          {error && (
            <div className="error-banner">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className="activity-modal-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} disabled={saving || !selected}>
              {saving ? 'Associando…' : 'Associar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
