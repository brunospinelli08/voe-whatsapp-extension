// LeadPanel.tsx
// Modo Lead: dado o telefone do chat ativo, mostra a oportunidade
// correspondente (se existir) com um menu de ações compacto; ou, quando não
// há nenhuma ainda, uma escolha explícita — "Nova oportunidade" sempre em
// primeiro, como ação principal — entre criar/vincular uma oportunidade e
// só salvar o contato. Nem todo contato que fala com a VOE vira uma venda.

import { useState } from 'react'
import type { ActiveChat } from '../hooks/useActiveChat'
import { useLeadLookup } from '../hooks/useLeadLookup'
import { ActionMenu } from './ActionMenu'
import { CreateOpportunityForm } from './CreateOpportunityForm'
import { SaveContactAction } from './SaveContactAction'
import { LinkExistingOpportunityForm } from './LinkExistingOpportunityForm'
import { OpportunityCard } from './OpportunityCard'
import { Spinner } from './Spinner'

interface Props {
  chat: ActiveChat
  workspaceId: string
}

type LeadAction = 'new-opportunity' | 'new-contact' | 'link-opportunity' | null

export function LeadPanel({ chat, workspaceId }: Props) {
  const { loading, error, contact, opportunity, searched, refetch } = useLeadLookup(chat.phone)
  const [action, setAction] = useState<LeadAction>(null)

  function handleDone() {
    setAction(null)
    refetch()
  }

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

      {/* Nada encontrado: nem contato, nem oportunidade */}
      {!loading && !error && searched && !contact && (
        <div className="empty-state">
          <p>Nenhum lead encontrado com esse telefone.</p>

          {action === null && (
            <div className="lead-choice-buttons">
              <button onClick={() => setAction('new-opportunity')}>Nova oportunidade</button>
              <button className="secondary" onClick={() => setAction('new-contact')}>
                Novo contato
              </button>
            </div>
          )}
          {action === 'new-opportunity' && (
            <CreateOpportunityForm chat={chat} onCreated={handleDone} onCancel={() => setAction(null)} />
          )}
          {action === 'new-contact' && (
            <SaveContactAction chat={chat} onSaved={handleDone} onCancel={() => setAction(null)} />
          )}
        </div>
      )}

      {/* Contato já existe, mas ainda não está ligado a nenhuma oportunidade */}
      {!loading && !error && contact && !opportunity && (
        <div className="empty-state">
          <p>
            Contato encontrado (<strong>{contact.name || contact.phone}</strong>), ainda sem
            nenhuma oportunidade de venda vinculada.
          </p>

          {action === null && (
            <div className="lead-choice-buttons">
              <button onClick={() => setAction('new-opportunity')}>Nova oportunidade</button>
              <button className="secondary" onClick={() => setAction('link-opportunity')}>
                Vincular oportunidade
              </button>
            </div>
          )}
          {action === 'new-opportunity' && (
            <CreateOpportunityForm
              chat={chat}
              existingContactId={contact.id}
              onCreated={handleDone}
              onCancel={() => setAction(null)}
            />
          )}
          {action === 'link-opportunity' && (
            <LinkExistingOpportunityForm
              contactId={contact.id}
              onLinked={handleDone}
              onCancel={() => setAction(null)}
            />
          )}
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
