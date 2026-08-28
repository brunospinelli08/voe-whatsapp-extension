// CreateCompanyModal.tsx
// Réplica exata do modal "Nova Empresa" (app.voeops.com/companies/page.tsx,
// LABEL/INPUT compartilhados no arquivo) — mesmos campos, mesmos pares,
// mesmos placeholders: Nome (obrigatório) → Telefone/Email → Site/
// Instagram → CNPJ/Estado → Cidade.
//
// Associação automática ao contato atual: confirmado direto no código real
// (contacts/[id]/page.tsx, handleEditSubmit — a única tela onde criar
// empresa acontece a partir do contexto de um contato) que criar uma
// empresa ali SEMPRE associa ao contato no mesmo submit, sem passo manual
// separado — primeiro `createCompany()`, depois `updateContact(id, {
// company_id: newCo.id })`. Replicado aqui exatamente assim: POST
// /api/v1/companies seguido de PUT /api/v1/contacts/:id.

import { FormEvent, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import type { LeadContact } from '../hooks/useLeadLookup'
import { XIcon } from './Icons'

interface FormState {
  name: string
  phone: string
  email: string
  website: string
  instagram: string
  cnpj: string
  state: string
  city: string
}

const EMPTY: FormState = { name: '', phone: '', email: '', website: '', instagram: '', cnpj: '', state: '', city: '' }

interface Props {
  contact: LeadContact
  onClose: () => void
  onCreated: () => void
}

export function CreateCompanyModal({ contact, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { data: company } = await voeApi.post<{ data: { id: string } }>('/api/v1/companies', {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        instagram: form.instagram.trim() || null,
        cnpj: form.cnpj.trim() || null,
        state: form.state.trim() || null,
        city: form.city.trim() || null,
      })
      // Associação automática — mesmo comportamento do fluxo real (ver nota acima).
      await voeApi.put(`/api/v1/contacts/${contact.id}`, { company_id: company.id })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar empresa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="activity-modal-backdrop" onClick={onClose}>
      <div className="activity-modal" onClick={e => e.stopPropagation()}>
        <div className="activity-modal-header">
          <h3>Nova Empresa</h3>
          <button type="button" className="activity-modal-close" onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="activity-modal-body">
          <label>
            Nome *
            <input value={form.name} onChange={set('name')} required autoFocus placeholder="Nome da empresa" />
          </label>

          <div className="field-pair">
            <label>
              Telefone
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(11) 99999-9999" />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={set('email')} placeholder="contato@empresa.com" />
            </label>
          </div>

          <div className="field-pair">
            <label>
              Site
              <input type="url" value={form.website} onChange={set('website')} placeholder="https://empresa.com" />
            </label>
            <label>
              Instagram
              <input value={form.instagram} onChange={set('instagram')} placeholder="@empresa" />
            </label>
          </div>

          <div className="field-pair">
            <label>
              CNPJ
              <input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />
            </label>
            <label>
              Estado
              <input value={form.state} onChange={set('state')} placeholder="SP" maxLength={2} />
            </label>
          </div>

          <label>
            Cidade
            <input value={form.city} onChange={set('city')} placeholder="São Paulo" />
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
            <button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? 'Criando…' : 'Criar empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
