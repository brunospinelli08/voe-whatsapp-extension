// CreateLeadForm.tsx
// Cria um lead a partir do contato ativo do WhatsApp: contato -> oportunidade
// -> vínculo entre os dois (POST /api/v1/opportunities/:id/contacts).

import { FormEvent, useState } from 'react'
import type { ActiveChat } from '../hooks/useActiveChat'
import { voeApi } from '../lib/apiClient'

interface Props {
  chat: ActiveChat
  /** Se já existe um contato pra esse telefone (achado pelo useLeadLookup), reaproveita em vez de criar outro. */
  existingContactId?: string | null
  onCreated: () => void
}

export function CreateLeadForm({ chat, existingContactId, onCreated }: Props) {
  const [name, setName] = useState(chat.name ?? '')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setError(null)
    try {
      let contactId = existingContactId

      if (!contactId) {
        const { data: contact } = await voeApi.post<{ data: { id: string } }>(
          '/api/v1/contacts',
          { name: name.trim() || chat.phone, phone: chat.phone },
        )
        contactId = contact.id
      }

      const { data: opportunity } = await voeApi.post<{ data: { id: string } }>(
        '/api/v1/opportunities',
        { name: `${name.trim() || chat.phone} (WhatsApp)`, source: 'whatsapp_extension' },
      )

      await voeApi.post(`/api/v1/opportunities/${opportunity.id}/contacts`, {
        contact_id: contactId,
        is_primary_contact: true,
      })

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lead')
    } finally {
      setCreating(false)
    }
  }

  return (
    <form className="create-lead-form" onSubmit={handleSubmit}>
      <label>
        Nome
        <input value={name} onChange={e => setName(e.target.value)} placeholder={chat.phone} />
      </label>
      <button type="submit" disabled={creating}>
        {creating ? 'Criando…' : 'Criar lead'}
      </button>
      {error && <p className="error-text">{error}</p>}
    </form>
  )
}
