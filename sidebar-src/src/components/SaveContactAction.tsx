// SaveContactAction.tsx
// Salva só o contato (POST /api/v1/contacts), sem criar oportunidade.
// Existe pra separar as duas ações que antes vinham grudadas num botão só
// ("Criar lead" criava contato + oportunidade sempre) — nem todo contato
// que fala com a VOE vira uma oportunidade de venda.

import { useState } from 'react'
import type { ActiveChat } from '../hooks/useActiveChat'
import { voeApi } from '../lib/apiClient'

interface Props {
  chat: ActiveChat
  onSaved: () => void
}

export function SaveContactAction({ chat, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setSaving(true)
    setError(null)
    try {
      await voeApi.post('/api/v1/contacts', {
        name: chat.name || chat.phone,
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
    <div>
      <button className="secondary" disabled={saving} onClick={handleClick}>
        {saving ? 'Salvando…' : 'Salvar contato'}
      </button>
      {error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
