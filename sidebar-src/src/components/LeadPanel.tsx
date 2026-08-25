// LeadPanel.tsx
// Modo Lead: dado o telefone do chat ativo, mostra a oportunidade
// correspondente (se existir) com etapa do funil e anotações, ou o
// formulário de criação de lead quando não há nenhuma ainda.

import type { ActiveChat } from '../hooks/useActiveChat'
import { useLeadLookup } from '../hooks/useLeadLookup'
import { StageSelector } from './StageSelector'
import { NotesForm } from './NotesForm'
import { CreateLeadForm } from './CreateLeadForm'

interface Props {
  chat: ActiveChat
}

export function LeadPanel({ chat }: Props) {
  const { loading, error, contact, opportunity, searched, refetch } = useLeadLookup(chat.phone)

  return (
    <div className="lead-panel">
      <header className="active-chat-header">
        <strong>{chat.name || chat.phone}</strong>
        {chat.name && <span className="chat-phone">{chat.phone}</span>}
      </header>

      {loading && <p className="muted">Buscando lead…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && searched && !contact && (
        <div className="empty-state">
          <p>Nenhum lead encontrado com esse telefone.</p>
          <CreateLeadForm chat={chat} onCreated={refetch} />
        </div>
      )}

      {!loading && contact && !opportunity && (
        <div className="empty-state">
          <p>
            Contato encontrado (<strong>{contact.name || contact.phone}</strong>), mas sem
            nenhuma oportunidade ativa vinculada.
          </p>
          <CreateLeadForm chat={chat} existingContactId={contact.id} onCreated={refetch} />
        </div>
      )}

      {!loading && opportunity && (
        <div className="opportunity-detail">
          <h2>{opportunity.name}</h2>
          {opportunity.pipeline && <p className="muted">{opportunity.pipeline.name}</p>}

          <StageSelector
            opportunityId={opportunity.id}
            currentStageId={opportunity.stage_id}
            onMoved={refetch}
          />

          <NotesForm opportunityId={opportunity.id} />
        </div>
      )}
    </div>
  )
}
