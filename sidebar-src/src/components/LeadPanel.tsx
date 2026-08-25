// LeadPanel.tsx
// Modo Lead: dado o telefone do chat ativo, mostra a oportunidade
// correspondente (se existir) com etapa do funil e anotações.
//
// "Criar lead" (quando não há nenhuma oportunidade vinculada a esse
// telefone ainda) depende de um endpoint novo em /api/v1/* pra vincular
// contato <-> oportunidade (opportunity_contacts) — combinado com o Bruno
// antes de implementar, por mexer numa rota compartilhada com o resto do
// produto. Até lá, mostramos o estado e deixamos claro o motivo.

import type { ActiveChat } from '../hooks/useActiveChat'
import { useLeadLookup } from '../hooks/useLeadLookup'
import { StageSelector } from './StageSelector'
import { NotesForm } from './NotesForm'

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
          <p className="muted">
            Criar lead direto da sidebar depende de um endpoint novo no backend (vincular
            contato à oportunidade) — ainda não implementado, aguardando aprovação.
          </p>
        </div>
      )}

      {!loading && contact && !opportunity && (
        <div className="empty-state">
          <p>
            Contato encontrado (<strong>{contact.name || contact.phone}</strong>), mas sem
            nenhuma oportunidade ativa vinculada.
          </p>
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
