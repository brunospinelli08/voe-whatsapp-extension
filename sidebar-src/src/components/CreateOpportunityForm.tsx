// CreateOpportunityForm.tsx
// Cria uma OPORTUNIDADE de venda a partir do contato ativo do WhatsApp —
// contato (se ainda não existir) -> oportunidade -> vínculo entre os dois
// (POST /api/v1/opportunities/:id/contacts). Ação distinta e explícita de
// "só salvar o contato" (ver SaveContactAction.tsx) — nem todo contato que
// fala com a VOE deve virar uma oportunidade de venda.
//
// Campos de Origem e campos personalizados são carregados dinamicamente do
// workspace (useOriginOptions / useCustomFields) — igual o formulário real
// de Nova Oportunidade do dashboard faz. Nenhum campo é hardcoded aqui além
// de Nome, que é sempre fixo em qualquer workspace.

import { FormEvent, useState } from 'react'
import type { ActiveChat } from '../hooks/useActiveChat'
import { voeApi } from '../lib/apiClient'
import { supabase } from '../lib/supabaseClient'
import { useOriginOptions } from '../hooks/useOriginOptions'
import { useCustomFields } from '../hooks/useCustomFields'
import { CustomFieldInput, type CustomFieldValue } from './CustomFieldInput'

interface Props {
  chat: ActiveChat
  /** Se já existe um contato pra esse telefone (achado pelo useLeadLookup), reaproveita em vez de criar outro. */
  existingContactId?: string | null
  onCreated: () => void
  /** Só aparece quando essa tela foi aberta por escolha explícita (contato ainda não existia). */
  onCancel?: () => void
}

interface Stage {
  id: string
  order: number
}

interface Pipeline {
  id: string
  is_default: boolean
  pipeline_stages: Stage[]
}

/** Acha a primeira etapa (menor `order`) do pipeline padrão do workspace (ou do primeiro pipeline, se nenhum estiver marcado como padrão). */
async function getDefaultStageId(): Promise<string> {
  const { data: pipelines } = await voeApi.get<{ data: Pipeline[] }>('/api/v1/pipelines')
  const pipeline = pipelines.find(p => p.is_default) ?? pipelines[0]
  if (!pipeline) throw new Error('Nenhum pipeline configurado nesse workspace.')

  const firstStage = [...pipeline.pipeline_stages].sort((a, b) => a.order - b.order)[0]
  if (!firstStage) throw new Error('Pipeline sem nenhuma etapa configurada.')

  return firstStage.id
}

export function CreateOpportunityForm({ chat, existingContactId, onCreated, onCancel }: Props) {
  const [name, setName] = useState(chat.name ?? '')
  const [originId, setOriginId] = useState('')
  const [customValues, setCustomValues] = useState<Record<string, CustomFieldValue>>({})
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { origins } = useOriginOptions()
  const { fields: customFields } = useCustomFields('deal')

  function setCustomValue(label: string, value: CustomFieldValue) {
    setCustomValues(prev => ({ ...prev, [label]: value }))
  }

  function missingRequiredField(): string | null {
    for (const field of customFields) {
      if (!field.required) continue
      const value = customValues[field.label]
      const empty =
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (field.type === 'checkbox' && value !== true)
      if (empty) return field.label
    }
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
      let contactId = existingContactId

      if (!contactId) {
        const { data: contact } = await voeApi.post<{ data: { id: string } }>(
          '/api/v1/contacts',
          { name: name.trim() || chat.phone, phone: chat.phone },
        )
        contactId = contact.id
      }

      const stageId = await getDefaultStageId()

      // Atribui ao próprio usuário logado na extensão — sem isso o lead
      // nasce sem responsável e alguns filtros do dashboard (ex: "meus
      // leads" na tela de Funil) escondem oportunidades sem assigned_to,
      // dando a impressão de que o lead não foi criado quando na verdade
      // só está fora do filtro.
      const { data: sessionData } = await supabase.auth.getSession()
      const assignedTo = sessionData.session?.user.id ?? null

      const { data: opportunity } = await voeApi.post<{ data: { id: string } }>(
        '/api/v1/opportunities',
        {
          name: `${name.trim() || chat.phone} (WhatsApp)`,
          stage_id: stageId,
          assigned_to: assignedTo,
          origin_id: originId || null,
        },
      )

      await voeApi.post(`/api/v1/opportunities/${opportunity.id}/contacts`, {
        contact_id: contactId,
        is_primary_contact: true,
      })

      // Campos personalizados do workspace (se algum foi preenchido) — via
      // PUT /api/v1/opportunities/[id]/custom-fields, que já existia.
      if (Object.keys(customValues).length > 0) {
        await voeApi
          .put(`/api/v1/opportunities/${opportunity.id}/custom-fields`, { fields: customValues })
          .catch(() => {}) // best-effort — não trava a criação do lead se isso falhar
      }

      await voeApi
        .post(`/api/v1/opportunities/${opportunity.id}/notes`, {
          content: 'Lead criado a partir da extensão de WhatsApp da VOE.',
        })
        .catch(() => {}) // best-effort — não trava a criação do lead se isso falhar

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
        Nome
        <input value={name} onChange={e => setName(e.target.value)} placeholder={chat.phone} />
      </label>

      {origins.length > 0 && (
        <label>
          Origem
          <select value={originId} onChange={e => setOriginId(e.target.value)}>
            <option value="">— selecione —</option>
            {origins.map(origin => (
              <option key={origin.id} value={origin.id}>
                {origin.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {customFields.map(field => (
        <CustomFieldInput
          key={field.id}
          field={field}
          value={customValues[field.label]}
          onChange={value => setCustomValue(field.label, value)}
        />
      ))}

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
