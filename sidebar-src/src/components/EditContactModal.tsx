// EditContactModal.tsx
// Réplica do EditContactModal real (ContextPanel.tsx, app.voeops.com —
// definido inline lá, não é um componente compartilhado): Nome*, Telefone,
// E-mail, Cargo, Tipo de contato, Tags. Salva via PUT /api/v1/contacts/:id
// (genérico, já existia).

import { FormEvent, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import type { LeadContact } from '../hooks/useLeadLookup'
import { XIcon } from './Icons'

const CONTACT_TYPES: { value: NonNullable<LeadContact['contact_type']>; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'parceiro', label: 'Parceiro' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'outro', label: 'Outro' },
]

interface Props {
  contact: LeadContact
  onClose: () => void
  onSaved: () => void
}

export function EditContactModal({ contact, onClose, onSaved }: Props) {
  const [name, setName] = useState(contact.name ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [roleTitle, setRoleTitle] = useState(contact.role_title ?? '')
  const [contactType, setContactType] = useState(contact.contact_type ?? 'lead')
  const [tagsInput, setTagsInput] = useState((contact.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      await voeApi.put(`/api/v1/contacts/${contact.id}`, {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        role_title: roleTitle.trim() || null,
        contact_type: contactType,
        tags,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar contato')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="activity-modal-backdrop" onClick={onClose}>
      <div className="activity-modal" onClick={e => e.stopPropagation()}>
        <div className="activity-modal-header">
          <h3>Editar contato</h3>
          <button type="button" className="activity-modal-close" onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="activity-modal-body">
          <label>
            Nome *
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </label>
          <label>
            Telefone
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </label>
          <label>
            E-mail
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" />
          </label>
          <label>
            Cargo
            <input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="Ex: CEO, Gerente..." />
          </label>
          <div>
            <span className="form-label-standalone">Tipo de contato</span>
            <div className="contact-type-options">
              {CONTACT_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`contact-type-chip${contactType === t.value ? ' is-active' : ''}`}
                  onClick={() => setContactType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <label>
            Tags
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="tag1, tag2, tag3..." />
            <span className="field-hint">Separe por vírgulas</span>
          </label>

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
            <button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
