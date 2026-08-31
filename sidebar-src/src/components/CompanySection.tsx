// CompanySection.tsx
// Seção "Empresa" do formulário de Nova Oportunidade: Sem empresa /
// Vincular existente / Criar nova — mesmos campos do formulário real
// (CNPJ, telefone, e-mail, Instagram, website, endereço, cidade, estado,
// notas).

import { useCallback } from 'react'
import { voeApi } from '../lib/apiClient'
import { SearchSelect, type SearchableItem } from './SearchSelect'
import { XIcon, LinkIcon, PlusIcon } from './Icons'

export type CompanyMode = 'none' | 'link' | 'create'

export interface NewCompanyData {
  name: string
  cnpj: string
  phone: string
  email: string
  instagram: string
  website: string
  address: string
  city: string
  state: string
  notes: string
}

export const EMPTY_NEW_COMPANY: NewCompanyData = {
  name: '', cnpj: '', phone: '', email: '', instagram: '', website: '', address: '', city: '', state: '', notes: '',
}

interface Props {
  mode: CompanyMode
  onModeChange: (mode: CompanyMode) => void
  linkedCompany: SearchableItem | null
  onLinkedCompanyChange: (item: SearchableItem | null) => void
  newCompany: NewCompanyData
  onNewCompanyChange: (data: NewCompanyData) => void
}

interface CompanyApiItem {
  id: string
  name: string
}

export function CompanySection({
  mode, onModeChange, linkedCompany, onLinkedCompanyChange, newCompany, onNewCompanyChange,
}: Props) {
  const fetchCompanies = useCallback(async (query: string) => {
    const res = await voeApi.get<{ data: CompanyApiItem[] }>(`/api/v1/companies?search=${encodeURIComponent(query)}`)
    return res.data.map(c => ({ id: c.id, name: c.name }))
  }, [])

  function setField<K extends keyof NewCompanyData>(key: K, value: string) {
    onNewCompanyChange({ ...newCompany, [key]: value })
  }

  return (
    <div className="form-section">
      <p className="action-menu-title">Empresa</p>
      <div className="company-mode-row">
        <button
          type="button"
          className={`company-mode-btn${mode === 'none' ? ' is-active' : ''}`}
          onClick={() => onModeChange('none')}
        >
          <XIcon size={13} /> Nenhuma
        </button>
        <button
          type="button"
          className={`company-mode-btn${mode === 'link' ? ' is-active' : ''}`}
          onClick={() => onModeChange('link')}
        >
          <LinkIcon size={13} /> Vincular
        </button>
        <button
          type="button"
          className={`company-mode-btn${mode === 'create' ? ' is-active' : ''}`}
          onClick={() => onModeChange('create')}
        >
          <PlusIcon size={13} /> Criar
        </button>
      </div>

      {mode === 'link' && (
        <SearchSelect
          fetchItems={fetchCompanies}
          selected={linkedCompany}
          onSelect={item => onLinkedCompanyChange(item.id ? item : null)}
          placeholder="Buscar empresa..."
        />
      )}

      {mode === 'create' && (
        <div className="form-subsection">
          <label>
            Nome da empresa *
            <input value={newCompany.name} onChange={e => setField('name', e.target.value)} placeholder="Razão social ou nome fantasia" />
          </label>
          <label>CNPJ<input value={newCompany.cnpj} onChange={e => setField('cnpj', e.target.value)} placeholder="00.000.000/0001-00" /></label>
          <label>Telefone<input value={newCompany.phone} onChange={e => setField('phone', e.target.value)} placeholder="(11) 99999-9999" /></label>
          <label>E-mail<input type="email" value={newCompany.email} onChange={e => setField('email', e.target.value)} placeholder="contato@empresa.com" /></label>
          <label>Instagram<input value={newCompany.instagram} onChange={e => setField('instagram', e.target.value)} placeholder="@empresa" /></label>
          <label>Website<input value={newCompany.website} onChange={e => setField('website', e.target.value)} placeholder="www.empresa.com" /></label>
          <label>Endereço<input value={newCompany.address} onChange={e => setField('address', e.target.value)} placeholder="Rua, número, bairro" /></label>
          <label>Cidade<input value={newCompany.city} onChange={e => setField('city', e.target.value)} placeholder="São Paulo" /></label>
          <label>Estado<input value={newCompany.state} onChange={e => setField('state', e.target.value)} placeholder="SP" maxLength={2} /></label>
          <label>Notas<textarea rows={2} value={newCompany.notes} onChange={e => setField('notes', e.target.value)} placeholder="Observações..." /></label>
        </div>
      )}
    </div>
  )
}
