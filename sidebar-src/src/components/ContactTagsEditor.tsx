// ContactTagsEditor.tsx
// Tipo de contato (badge, clicável pra trocar) + tags (adicionar/remover) —
// mesmo par de campos do header do ContextPanel.tsx real. Salva via
// PUT /api/v1/contacts/:id (endpoint que já existia).

import { FormEvent, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import type { LeadContact } from '../hooks/useLeadLookup'

// Mesmos labels/valores de ContextPanel.tsx (CONTACT_TYPES)
const CONTACT_TYPES: { value: NonNullable<LeadContact['contact_type']>; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'parceiro', label: 'Parceiro' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'outro', label: 'Outro' },
]

interface Props {
  contact: LeadContact
  onChanged: () => void
}

export function ContactTagsEditor({ contact, onChanged }: Props) {
  const [editingType, setEditingType] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  const tags = contact.tags ?? []
  const typeLabel = CONTACT_TYPES.find(t => t.value === contact.contact_type)?.label ?? null

  async function updateContact(patch: Record<string, unknown>) {
    setSaving(true)
    try {
      await voeApi.put(`/api/v1/contacts/${contact.id}`, patch)
      onChanged()
    } catch {
      // Best-effort — o painel só não atualiza visualmente se falhar; não
      // trava nenhum outro fluxo por causa disso.
    } finally {
      setSaving(false)
    }
  }

  function handleSetType(value: string) {
    setEditingType(false)
    updateContact({ contact_type: value })
  }

  function handleAddTag(event: FormEvent) {
    event.preventDefault()
    const tag = tagInput.trim()
    if (!tag || tags.includes(tag)) {
      setShowTagInput(false)
      setTagInput('')
      return
    }
    setShowTagInput(false)
    setTagInput('')
    updateContact({ tags: [...tags, tag] })
  }

  function handleRemoveTag(tag: string) {
    updateContact({ tags: tags.filter(t => t !== tag) })
  }

  return (
    <div className="contact-tags-row">
      {editingType ? (
        <div className="contact-type-options">
          {CONTACT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              disabled={saving}
              className={`contact-type-chip${contact.contact_type === t.value ? ' is-active' : ''}`}
              onClick={() => handleSetType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className={`contact-type-badge${typeLabel ? '' : ' is-empty'}`}
          onClick={() => setEditingType(true)}
          title="Clique para mudar o tipo"
        >
          {typeLabel ?? 'Tipo'}
        </button>
      )}

      {tags.map(tag => (
        <span key={tag} className="contact-tag">
          #{tag}
          <button type="button" onClick={() => handleRemoveTag(tag)} title="Remover tag">×</button>
        </span>
      ))}

      {showTagInput ? (
        <form className="contact-tag-form" onSubmit={handleAddTag}>
          <input
            autoFocus
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setShowTagInput(false); setTagInput('') } }}
            onBlur={() => { if (!tagInput.trim()) setShowTagInput(false) }}
            placeholder="nova-tag"
          />
        </form>
      ) : (
        <button type="button" className="contact-tag-add" onClick={() => setShowTagInput(true)}>
          + tag
        </button>
      )}
    </div>
  )
}
