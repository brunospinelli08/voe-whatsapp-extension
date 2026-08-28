// OpportunityDetail.tsx
// Bloco "OPORTUNIDADE" (quando já existe uma vinculada) da aba Contexto —
// espelha ContextPanel.tsx campo a campo, na mesma ordem: nome + link,
// empresa, Status|Etapa lado a lado, Lead Score, Qualificação (estrelas),
// Orçamento estimado, Valor total, Origem, Campanha, campos personalizados,
// campos de segmento do workspace, "Criado em"/"Ganho em"/"Perdido em",
// Anotações. Substitui OpportunityCard.tsx (card resumido) + a fatia de
// ActionMenu.tsx que cuidava de etapa/status/anotação.

import { useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { VOE_API_BASE } from '../config'
import type { LeadContact, LeadOpportunity } from '../hooks/useLeadLookup'
import { useOpportunityDetail } from '../hooks/useOpportunityDetail'
import { useLeadScoringConfig } from '../hooks/useLeadScoringConfig'
import { useQualificationLabels } from '../hooks/useQualificationLabels'
import { useOriginOptions } from '../hooks/useOriginOptions'
import { useCampaignOptions } from '../hooks/useCampaignOptions'
import { useCustomFields } from '../hooks/useCustomFields'
import { useSegmentFields } from '../hooks/useSegmentFields'
import { LeadScoreBadge } from './LeadScoreBadge'
import { StatusStagePicker } from './StatusStagePicker'
import { StaticFieldRow, StarFieldRow, CurrencyFieldRow, SelectFieldRow, TextFieldRow, BooleanFieldRow } from './OpportunityFieldRow'
import { NotesForm } from './NotesForm'
import { ExternalLinkIcon } from './Icons'
import { Spinner } from './Spinner'

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR')
}

interface Props {
  opportunity: LeadOpportunity
  workspaceId: string
  activeContact: LeadContact | null
  onChanged: () => void
}

export function OpportunityDetail({ opportunity, workspaceId, activeContact, onChanged }: Props) {
  const { detail, loading, error, refetch, patch, patchSegmentField } = useOpportunityDetail(opportunity.id)
  const { isActive: leadScoringActive, bands: scoreBands } = useLeadScoringConfig()
  const { labels: qualLabels } = useQualificationLabels()
  const { origins } = useOriginOptions()
  const { campaigns } = useCampaignOptions()
  const { fields: customFieldDefs } = useCustomFields('deal')
  const { fields: segmentFieldDefs } = useSegmentFields()

  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const alreadyLinked = !activeContact || opportunity.contacts.some(c => c.id === activeContact.id)

  async function handleAddContact() {
    if (!activeContact) return
    setLinking(true)
    setLinkError(null)
    try {
      await voeApi.post(`/api/v1/opportunities/${opportunity.id}/contacts`, { contact_id: activeContact.id })
      onChanged()
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Erro ao vincular contato')
    } finally {
      setLinking(false)
    }
  }

  function handleChanged() {
    refetch()
    onChanged()
  }

  async function saveCustomField(label: string, value: string) {
    await voeApi.put(`/api/v1/opportunities/${opportunity.id}/custom-fields`, { fields: { [label]: value } }).catch(() => {})
    refetch()
  }

  if (loading && !detail) return <Spinner label="Carregando oportunidade…" />

  if (error && !detail) {
    return (
      <div className="error-banner">
        <span>⚠</span>
        <span>{error}</span>
      </div>
    )
  }

  if (!detail) return null

  const customValueById = new Map(detail.custom_fields.map(cf => [cf.id, cf.value]))

  return (
    <div className="opportunity-detail">
      <div className="opp-name-row">
        <span className="opp-name">{detail.name}</span>
        <a
          href={`${VOE_API_BASE}/deals/${detail.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="opp-external-link"
          title="Abrir na VOE"
        >
          <ExternalLinkIcon size={13} />
        </a>
      </div>
      {detail.company?.name && <p className="opp-company">{detail.company.name}</p>}

      <StatusStagePicker
        opportunityId={detail.id}
        workspaceId={workspaceId}
        pipelineId={detail.pipeline?.id ?? null}
        currentStageId={detail.stage?.id ?? ''}
        currentStatus={detail.status}
        onChanged={handleChanged}
      />

      <div className="opp-field-list">
        {leadScoringActive && typeof detail.lead_score === 'number' && (
          <div className="opp-field-row">
            <span className="opp-field-label">Lead Score</span>
            <div className="opp-field-value">
              <LeadScoreBadge score={detail.lead_score} bands={scoreBands} />
            </div>
          </div>
        )}

        <StarFieldRow
          label="Qualificação"
          value={detail.qualification_score}
          labels={qualLabels}
          onSave={v => patch({ qualification_score: v })}
        />

        <CurrencyFieldRow
          label="Orçamento estimado"
          value={detail.estimated_budget}
          onSave={v => patch({ estimated_budget: v })}
        />

        <StaticFieldRow
          label="Valor total"
          value={detail.total_value > 0 ? `R$ ${detail.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null}
        />

        {origins.length > 0 && (
          <SelectFieldRow
            label="Origem"
            value={origins.find(o => o.id === detail.origin_id)?.label ?? null}
            options={origins.map(o => o.label)}
            onSave={label => patch({ origin_id: origins.find(o => o.label === label)?.id ?? null })}
          />
        )}

        {campaigns.length > 0 && (
          <SelectFieldRow
            label="Campanha"
            value={campaigns.find(c => c.id === detail.campaign_id)?.label ?? null}
            options={campaigns.map(c => c.label)}
            placeholder="Sem campanha"
            onSave={label => patch({ campaign_id: campaigns.find(c => c.label === label)?.id ?? null })}
          />
        )}

        {customFieldDefs.map(field => {
          const value = customValueById.get(field.id) ?? null
          if (field.type === 'option') {
            return (
              <SelectFieldRow
                key={field.id}
                label={field.label}
                value={value}
                options={field.options ?? []}
                onSave={v => saveCustomField(field.label, v ?? '')}
              />
            )
          }
          return (
            <TextFieldRow
              key={field.id}
              label={field.label}
              value={value}
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              onSave={v => saveCustomField(field.label, v ?? '')}
            />
          )
        })}

        {/* Campos nativos do segmento do workspace — dinâmico, não hardcoded.
            No workspace de teste (segmento "Espaço de Eventos") isso é o que
            traz Tipo de evento / Data do evento / Estimativa de convidados /
            Etapa do planejamento / Detalhes do evento; em outro segmento
            seriam campos totalmente diferentes (ver resumo). */}
        {segmentFieldDefs.map(field => {
          const value = detail.segment_data[field.key]
          if (field.type === 'boolean') {
            return (
              <BooleanFieldRow
                key={field.key}
                label={field.label}
                value={Boolean(value)}
                onSave={v => patchSegmentField(field.key, v)}
              />
            )
          }
          if (field.type === 'select' || field.type === 'multiselect') {
            return (
              <SelectFieldRow
                key={field.key}
                label={field.label}
                value={typeof value === 'string' ? value : null}
                options={field.options ?? []}
                onSave={v => patchSegmentField(field.key, v ?? '')}
              />
            )
          }
          return (
            <TextFieldRow
              key={field.key}
              label={field.label}
              value={typeof value === 'string' ? value : null}
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              onSave={v => patchSegmentField(field.key, v ?? '')}
            />
          )
        })}
      </div>

      <div className="opp-dates">
        <div className="opp-date-row">
          <span className="muted">Criado em</span>
          <span>{fmtDate(detail.created_at)}</span>
        </div>
        {detail.closed_at && (
          <div className="opp-date-row">
            <span className="muted">{detail.status === 'won' ? 'Ganho em' : 'Perdido em'}</span>
            <span className={detail.status === 'won' ? 'success-text' : 'error-text'}>{fmtDate(detail.closed_at)}</span>
          </div>
        )}
      </div>

      {!alreadyLinked && (
        <button className="secondary opp-add-contact-btn" disabled={linking} onClick={handleAddContact}>
          {linking ? 'Vinculando…' : 'Adicionar contato à oportunidade'}
        </button>
      )}
      {linkError && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{linkError}</span>
        </div>
      )}

      <div className="opp-notes-block">
        <span className="block-title">Anotações</span>
        <NotesForm opportunityId={detail.id} />
      </div>
    </div>
  )
}
