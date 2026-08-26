// CreateOpportunityForm.tsx
// Cria uma OPORTUNIDADE de venda a partir do contato ativo do WhatsApp —
// replica o formulário real de Nova Oportunidade do dashboard
// (NewOpportunityModal.tsx) campo a campo, buscando tudo dinamicamente do
// workspace (funil/etapa, responsável, unidade, campos de segmento, campos
// personalizados, qualificação, campanha, empresa) — nada hardcoded além
// de "Nome", que é sempre fixo em qualquer workspace.
//
// Decisão consciente de design: a seção "Contato" do modal real (Sem
// contato/Vincular existente/Criar novo) NÃO foi replicada como um toggle
// solto aqui. Na extensão, o contato já é sempre o da conversa do WhatsApp
// ativa — dar a opção de trocar isso abriria brecha pra criar uma
// oportunidade desvinculada da pessoa com quem se está falando, o que
// contraria o propósito da extensão. O contato do WhatsApp continua sendo
// criado/reaproveitado automaticamente (agora com dedupe: true).

import { FormEvent, useEffect, useState } from 'react'
import type { ActiveChat } from '../hooks/useActiveChat'
import { voeApi } from '../lib/apiClient'
import { supabase } from '../lib/supabaseClient'
import { useOriginOptions } from '../hooks/useOriginOptions'
import { useCampaignOptions } from '../hooks/useCampaignOptions'
import { useCustomFields } from '../hooks/useCustomFields'
import { useSegmentFields } from '../hooks/useSegmentFields'
import { usePipelines } from '../hooks/usePipelines'
import { useWorkspaceUsers } from '../hooks/useWorkspaceUsers'
import { useWorkspaceUnits } from '../hooks/useWorkspaceUnits'
import { useQualificationLabels } from '../hooks/useQualificationLabels'
import { CustomFieldInput, type CustomFieldValue } from './CustomFieldInput'
import { SegmentFieldInput, type SegmentFieldValue } from './SegmentFieldInput'
import { QualificationPicker } from './QualificationPicker'
import { CompanySection, EMPTY_NEW_COMPANY, type CompanyMode, type NewCompanyData } from './CompanySection'

// ── Helpers de moeda (mesma máscara do formulário real) ─────────────────────
function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const cents = Math.min(parseInt(digits, 10), 9999999999)
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function parseBRL(masked: string): number | null {
  if (!masked) return null
  const n = parseFloat(masked.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

interface Props {
  chat: ActiveChat
  /** Se já existe um contato pra esse telefone (achado pelo useLeadLookup), reaproveita em vez de criar outro. */
  existingContactId?: string | null
  onCreated: () => void
  /** Só aparece quando essa tela foi aberta por escolha explícita (contato ainda não existia). */
  onCancel?: () => void
}

export function CreateOpportunityForm({ chat, existingContactId, onCreated, onCancel }: Props) {
  // ── Campos fixos ───────────────────────────────────────────────────────
  const [name, setName] = useState(chat.name ?? '')
  const [pipelineId, setPipelineId] = useState('')
  const [stageId, setStageId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [unitId, setUnitId] = useState('')
  const [qualScore, setQualScore] = useState<number | null>(null)
  const [budget, setBudget] = useState('')
  const [originId, setOriginId] = useState('')
  const [campaignId, setCampaignId] = useState('')

  // ── Empresa ────────────────────────────────────────────────────────────
  const [companyMode, setCompanyMode] = useState<CompanyMode>('none')
  const [linkedCompany, setLinkedCompany] = useState<{ id: string; name: string } | null>(null)
  const [newCompany, setNewCompany] = useState<NewCompanyData>(EMPTY_NEW_COMPANY)

  // ── Campos dinâmicos (segmento + personalizados) ──────────────────────
  const [segmentValues, setSegmentValues] = useState<Record<string, SegmentFieldValue>>({})
  const [customValues, setCustomValues] = useState<Record<string, CustomFieldValue>>({})

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { origins } = useOriginOptions()
  const { campaigns } = useCampaignOptions()
  const { fields: customFields } = useCustomFields('deal')
  const { fields: segmentFields } = useSegmentFields()
  const { pipelines } = usePipelines()
  const { users } = useWorkspaceUsers()
  const { units } = useWorkspaceUnits()
  const { labels: qualLabels } = useQualificationLabels()

  const stages = pipelines.find(p => p.id === pipelineId)?.pipeline_stages ?? []

  // Seleciona o pipeline padrão (ou o primeiro) assim que a lista carrega.
  useEffect(() => {
    if (pipelineId || pipelines.length === 0) return
    const def = pipelines.find(p => p.is_default) ?? pipelines[0]
    setPipelineId(def.id)
  }, [pipelines, pipelineId])

  // Seleciona a primeira etapa (menor order) sempre que o pipeline muda.
  useEffect(() => {
    const sorted = [...stages].sort((a, b) => a.order - b.order)
    if (sorted.length > 0 && !sorted.find(s => s.id === stageId)) {
      setStageId(sorted[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, stages.length])

  function setCustomValue(label: string, value: CustomFieldValue) {
    setCustomValues(prev => ({ ...prev, [label]: value }))
  }
  function setSegmentValue(key: string, value: SegmentFieldValue) {
    setSegmentValues(prev => ({ ...prev, [key]: value }))
  }

  function missingRequiredField(): string | null {
    for (const field of customFields) {
      if (!field.required) continue
      const value = customValues[field.label]
      const empty = value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || (field.type === 'checkbox' && value !== true)
      if (empty) return field.label
    }
    for (const field of segmentFields) {
      if (!field.required) continue
      const value = segmentValues[field.key]
      const empty = value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || (field.type === 'boolean' && value !== true)
      if (empty) return field.label
    }
    if (companyMode === 'create' && !newCompany.name.trim()) return 'Nome da empresa'
    return null
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const missing = missingRequiredField()
    if (missing) {
      setError(`Preencha o campo obrigatório "${missing}".`)
      return
    }

    setCreating(true)
    setError(null)
    try {
      // 1. Contato — sempre o do WhatsApp ativo (ver nota no topo do arquivo).
      let contactId = existingContactId
      if (!contactId) {
        const { data: contact } = await voeApi.post<{ data: { id: string } }>('/api/v1/contacts', {
          name: name.trim() || chat.phone,
          phone: chat.phone,
          dedupe: true,
        })
        contactId = contact.id
      }

      // 2. Empresa — vincular existente ou criar nova.
      let companyId: string | null = null
      if (companyMode === 'link' && linkedCompany) {
        companyId = linkedCompany.id
      } else if (companyMode === 'create') {
        const { data: company } = await voeApi.post<{ data: { id: string } }>('/api/v1/companies', {
          name: newCompany.name.trim(),
          cnpj: newCompany.cnpj || null,
          phone: newCompany.phone || null,
          email: newCompany.email || null,
          instagram: newCompany.instagram || null,
          website: newCompany.website || null,
          address: newCompany.address || null,
          city: newCompany.city || null,
          state: newCompany.state || null,
          notes: newCompany.notes || null,
        })
        companyId = company.id
      }

      // 3. Responsável — usa o selecionado, ou o próprio usuário logado como fallback
      //    (sem isso o lead nasce sem responsável e alguns filtros do dashboard
      //    escondem oportunidades sem assigned_to).
      const { data: sessionData } = await supabase.auth.getSession()
      const finalAssignedTo = assignedTo || sessionData.session?.user.id || null

      // 4. Oportunidade
      const { data: opportunity } = await voeApi.post<{ data: { id: string } }>('/api/v1/opportunities', {
        name: `${name.trim() || chat.phone} (WhatsApp)`,
        stage_id: stageId,
        assigned_to: finalAssignedTo,
        origin_id: originId || null,
        campaign_id: campaignId || null,
        unit_id: unitId || null,
        qualification_score: qualScore,
        estimated_budget: parseBRL(budget),
        company_id: companyId,
        segment_data: Object.keys(segmentValues).length > 0 ? segmentValues : {},
      })

      // 5. Vincula o contato à oportunidade.
      await voeApi.post(`/api/v1/opportunities/${opportunity.id}/contacts`, {
        contact_id: contactId,
        is_primary_contact: true,
      })

      // 6. Campos personalizados (best-effort — não trava a criação se falhar).
      if (Object.keys(customValues).length > 0) {
        await voeApi
          .put(`/api/v1/opportunities/${opportunity.id}/custom-fields`, { fields: customValues })
          .catch(() => {})
      }

      await voeApi
        .post(`/api/v1/opportunities/${opportunity.id}/notes`, {
          content: 'Lead criado a partir da extensão de WhatsApp da VOE.',
        })
        .catch(() => {})

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar oportunidade')
    } finally {
      setCreating(false)
    }
  }

  return (
    <form className="create-opportunity-form" onSubmit={handleSubmit}>
      <label>
        Nome da oportunidade
        <input value={name} onChange={e => setName(e.target.value)} placeholder={chat.phone} />
      </label>

      {pipelines.length > 1 && (
        <div>
          <p className="form-label-standalone">Funil</p>
          <div className="pipeline-chips">
            {pipelines.map(p => (
              <button
                key={p.id}
                type="button"
                className={`pipeline-chip${pipelineId === p.id ? ' is-active' : ''}`}
                onClick={() => setPipelineId(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {stages.length > 0 && (
        <label>
          Etapa
          <select value={stageId} onChange={e => setStageId(e.target.value)}>
            {[...stages].sort((a, b) => a.order - b.order).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      )}

      {users.length > 0 && (
        <label>
          Responsável
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">Sem responsável</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </label>
      )}

      {units.length > 1 && (
        <label>
          Unidade
          <select value={unitId} onChange={e => setUnitId(e.target.value)}>
            <option value="">Sem unidade definida</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
      )}

      {segmentFields.map(field => (
        <SegmentFieldInput
          key={field.key}
          field={field}
          value={segmentValues[field.key]}
          onChange={value => setSegmentValue(field.key, value)}
        />
      ))}

      {customFields.map(field => (
        <CustomFieldInput
          key={field.id}
          field={field}
          value={customValues[field.label]}
          onChange={value => setCustomValue(field.label, value)}
        />
      ))}

      <div>
        <p className="form-label-standalone">Qualificação</p>
        <QualificationPicker value={qualScore} onChange={setQualScore} labels={qualLabels} />
      </div>

      <label>
        Orçamento estimado
        <input value={budget} onChange={e => setBudget(maskBRL(e.target.value))} placeholder="0,00" inputMode="numeric" />
      </label>

      {origins.length > 0 && (
        <label>
          Origem
          <select value={originId} onChange={e => setOriginId(e.target.value)}>
            <option value="">— selecione —</option>
            {origins.map(origin => <option key={origin.id} value={origin.id}>{origin.label}</option>)}
          </select>
        </label>
      )}

      {campaigns.length > 0 && (
        <label>
          Campanha
          <select value={campaignId} onChange={e => setCampaignId(e.target.value)}>
            <option value="">Sem campanha</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      )}

      <CompanySection
        mode={companyMode}
        onModeChange={setCompanyMode}
        linkedCompany={linkedCompany}
        onLinkedCompanyChange={setLinkedCompany}
        newCompany={newCompany}
        onNewCompanyChange={setNewCompany}
      />

      <div className="create-opportunity-form-actions">
        <button type="submit" disabled={creating}>
          {creating ? 'Criando…' : 'Criar oportunidade'}
        </button>
        {onCancel && (
          <button type="button" className="secondary" disabled={creating} onClick={onCancel}>
            Cancelar
          </button>
        )}
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
