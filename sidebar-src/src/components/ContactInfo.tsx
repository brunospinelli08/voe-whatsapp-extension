import { useRef, useState, type ReactNode } from 'react'
import type { LeadContact } from '../hooks/useLeadLookup'
import { voeApi } from '../lib/apiClient'
import { normalizeToE164 } from '../lib/phoneUtils'
import { Building2Icon, MailIcon, PencilIcon, PhoneIcon } from './Icons'
import { ContactTagsEditor } from './ContactTagsEditor'

function ContactField({ value, label, placeholder, icon, type = 'text', onSave }: {
  value: string | null | undefined
  label: string
  placeholder: string
  icon?: ReactNode
  type?: 'text' | 'email' | 'tel'
  onSave: (value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finished = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  async function finish(cancel = false) {
    if (finished.current) return
    if (!cancel && !input.current?.reportValidity()) return
    finished.current = true
    if (cancel || draft.trim() === (value ?? '')) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch (err) {
      finished.current = false
      setError(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally { setSaving(false) }
  }

  return (
    <div className="contact-inline-field">
      {editing ? <div className="contact-inline-editor">
        {icon}
        <input ref={input} autoFocus type={type} value={draft} aria-label={label}
          required={label === 'Nome'} disabled={saving} placeholder={placeholder}
          onChange={e => { setDraft(e.target.value); setError(null) }}
          onBlur={() => void finish()}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); void finish() }
            if (e.key === 'Escape') { e.preventDefault(); void finish(true) }
          }} />
      </div> : <button type="button" className={`contact-inline-display${!value ? ' is-empty' : ''}`}
        title={value || placeholder} aria-label={`Editar ${label}`} onClick={() => {
          finished.current = false; setDraft(value ?? ''); setError(null); setEditing(true)
        }}>
        {icon}<span>{value || placeholder}</span><PencilIcon size={10} className="contact-edit-icon" />
      </button>}
      {saving && <span className="contact-save-feedback" role="status">Salvando…</span>}
      {error && <span className="contact-save-feedback error-text" role="alert">{error}</span>}
    </div>
  )
}

/** Mesmas linhas, proporções e edição compacta do ContextPanel do Inbox. */
export function ContactInfo({ contact, onChanged }: { contact: LeadContact; onChanged: () => void }) {
  async function save(field: 'name' | 'role_title' | 'phone' | 'email', value: string) {
    await voeApi.put(`/api/v1/contacts/${contact.id}`, {
      [field]: value || null,
      ...(field === 'phone' ? { phone_e164: normalizeToE164(value) } : {}),
    })
    onChanged()
  }
  return <div className="contact-header-block">
    <div className="contact-header-row">
      <div className="contact-name"><ContactField value={contact.name} label="Nome" placeholder="Nome do contato" onSave={v => save('name', v)} /></div>
      <div className="contact-role">
        {!contact.role_title && <span>Cargo:</span>}
        <ContactField value={contact.role_title} label="Cargo" placeholder="Não definido" onSave={v => save('role_title', v)} />
      </div>
    </div>
    <div className="contact-meta-row">
      <div className="contact-phone-cell"><ContactField value={contact.phone} label="Telefone" placeholder="Telefone" type="tel" icon={<PhoneIcon size={12} />} onSave={v => save('phone', v)} /></div>
      <div className="contact-email-cell"><ContactField value={contact.email} label="E-mail" placeholder="E-mail" type="email" icon={<MailIcon size={12} />} onSave={v => save('email', v)} /></div>
    </div>
    {contact.company?.name && <p className="contact-company"><Building2Icon size={9} />{contact.company.name}</p>}
    <ContactTagsEditor contact={contact} onChanged={onChanged} />
  </div>
}
