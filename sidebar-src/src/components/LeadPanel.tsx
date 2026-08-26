// LeadPanel.tsx
// Modo Lead: dado o telefone do chat ativo, mostra a oportunidade
// correspondente (se existir) com um menu de ações compacto, ou o
// formulário de criação de lead quando não há nenhuma ainda.

import type { ActiveChat } from '../hooks/useActiveChat'
import { useLeadLookup } from '../hooks/useLeadLookup'
import { ActionMenu } from './ActionMenu'
import { CreateLeadForm } from './CreateLeadForm'
import { Spinner } from './Spinner'

interface Props {
  chat: ActiveChat
  workspaceId: string
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  won: 'Ganho',
  lost: 'Perdido',
  paused: 'Pausado',
}

export function LeadPanel({ chat, workspaceId }: Props) {
  const { loading, error, contact, opportunity, searched, refetch } = useLeadLookup(chat.phone)

  return (
    <div className="lead-panel">
      <header className="active-chat-header">
        <strong>{chat.name || chat.phone}</strong>
        {chat.name && <span className="chat-phone">{chat.phone}</span>}
      </header>

      {loading && <Spinner label="Buscando lead…" />}

      {/* Erro de verdade (rede/API) — nunca cai no estado "não encontrado" por engano */}
      {!loading && error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && searched && !contact && (
        <div className="empty-state">
          <p>Nenhum lead encontrado com esse telefone.</p>
          <CreateLeadForm chat={chat} onCreated={refetch} />
        </div>
      )}

      {!loading && !error && contact && !opportunity && (
        <div className="empty-state">
          <p>
            Contato encontrado (<strong>{contact.name || contact.phone}</strong>), mas sem
            nenhuma oportunidade ativa vinculada.
          </p>
          <CreateLeadForm chat={chat} existingContactId={contact.id} onCreated={refetch} />
        </div>
      )}

      {!loading && !error && opportunity && (
        <div className="card opportunity-detail">
          <h2>{opportunity.name}</h2>
          <div className="opportunity-meta">
            <span className={`status-badge status-${opportunity.status}`}>
              {STATUS_LABELS[opportunity.status] ?? opportunity.status}
            </span>
            {opportunity.pipeline && <span className="muted">{opportunity.pipeline.name}</span>}
          </div>
          {opportunity.status === 'lost' && opportunity.lost_reason && (
            <p className="muted">Motivo: {opportunity.lost_reason}</p>
          )}

          <ActionMenu
            opportunityId={opportunity.id}
            workspaceId={workspaceId}
            pipelineId={opportunity.pipeline?.id ?? null}
            currentStageId={opportunity.stage_id}
            currentStatus={opportunity.status}
            contactId={opportunity.contacts[0]?.id ?? null}
            onChanged={refetch}
          />
        </div>
      )}
    </div>
  )
}
