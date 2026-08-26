// LeadPanel.tsx
// Modo Lead: dado o telefone do chat ativo, mostra a oportunidade
// correspondente (se existir) com um menu de ações compacto, ou o
// formulário de criação de lead quando não há nenhuma ainda.

import type { ActiveChat } from '../hooks/useActiveChat'
import { useLeadLookup } from '../hooks/useLeadLookup'
import { ActionMenu } from './ActionMenu'
import { CreateLeadForm } from './CreateLeadForm'
import { OpportunityCard } from './OpportunityCard'
import { Spinner } from './Spinner'

interface Props {
  chat: ActiveChat
  workspaceId: string
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
        <>
          <OpportunityCard opportunity={opportunity} activeContact={contact} onLinked={refetch} />

          <ActionMenu
            opportunityId={opportunity.id}
            workspaceId={workspaceId}
            pipelineId={opportunity.pipeline?.id ?? null}
            currentStageId={opportunity.stage_id}
            currentStatus={opportunity.status}
            contactId={opportunity.contacts[0]?.id ?? null}
            onChanged={refetch}
          />
        </>
      )}
    </div>
  )
}
