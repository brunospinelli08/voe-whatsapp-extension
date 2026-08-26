// SaveContactAction.tsx
// Mini-formulário pra salvar só o contato (POST /api/v1/contacts), sem
// criar oportunidade — só pede Nome, nada mais. Ação distinta e explícita
// de "Nova oportunidade" (ver CreateOpportunityForm.tsx): nem todo contato
// que fala com a VOE vira uma oportunidade de venda.

import { FormEvent, useState } from 'react'
import type { ActiveChat } from '../hooks/useActiveChat'
import { voeApi } from '../lib/apiClient'

interface Props {
  chat: ActiveChat
  onSaved: () => void
  onCancel: () => void
}

export function SaveContactAction({ chat, onSaved, onCancel }: Props) {
  const [name, setName] = useState(chat.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await voeApi.post('/api/v1/contacts', {
        name: name.trim() || chat.phone,
        phone: chat.phone,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar contato')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="save-contact-form" onSubmit={handleSubmit}>
      <label>
        Nome
        <input value={name} onChange={e => setName(e.target.value)} placeholder={chat.phone} autoFocus />
      </label>
      <div className="create-opportunity-form-actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar contato'}
        </button>
        <button type="button" className="secondary" disabled={saving} onClick={onCancel}>
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
