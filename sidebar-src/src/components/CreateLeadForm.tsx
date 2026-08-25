// CreateLeadForm.tsx
// Cria um lead a partir do contato ativo do WhatsApp: contato -> oportunidade
// -> vínculo entre os dois (POST /api/v1/opportunities/:id/contacts).

import { FormEvent, useState } from 'react'
import type { ActiveChat } from '../hooks/useActiveChat'
import { voeApi } from '../lib/apiClient'
import { supabase } from '../lib/supabaseClient'

interface Props {
  chat: ActiveChat
  /** Se já existe um contato pra esse telefone (achado pelo useLeadLookup), reaproveita em vez de criar outro. */
  existingContactId?: string | null
  onCreated: () => void
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
        { name: `${name.trim() || chat.phone} (WhatsApp)`, stage_id: stageId, assigned_to: assignedTo },
      )

      await voeApi.post(`/api/v1/opportunities/${opportunity.id}/contacts`, {
        contact_id: contactId,
        is_primary_contact: true,
      })

      // Registra a origem na timeline — não existe mais um campo `source`
      // livre em opportunities (virou origin_id/UTMs), então isso fica
      // registrado como anotação em vez de tentar mapear pra um dos dois.
      await voeApi
        .post(`/api/v1/opportunities/${opportunity.id}/notes`, {
          content: 'Lead criado a partir da extensão de WhatsApp da VOE.',
        })
        .catch(() => {}) // best-effort — não trava a criação do lead se isso falhar

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
