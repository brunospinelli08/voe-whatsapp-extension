// LeadPanel.tsx
// Painel principal — espelha o painel real de Contexto/Atividades do
// Inbox (app.voeops.com/src/app/(dashboard)/inbox/page.tsx, linhas
// ~3637-3782 + ContextPanel.tsx): duas abas fixas no topo ("Contexto" e
// "Atividades"), com o mesmo texto de estado vazio e a mesma dupla de
// ações "⇄ Vincular"/"+ Nova" na seção Oportunidade.

import { useEffect, useState } from 'react'
import type { ActiveChat } from '../hooks/useActiveChat'
import { useLeadLookup, type LeadContact } from '../hooks/useLeadLookup'
import { CreateOpportunityForm } from './CreateOpportunityForm'
import { SaveContactAction } from './SaveContactAction'
import { LinkExistingOpportunityForm } from './LinkExistingOpportunityForm'
import { OpportunityDetail } from './OpportunityDetail'
import { ContactInfo } from './ContactInfo'
import { ActivitiesPanel } from './ActivitiesPanel'
import { MessageCenterToggle, MessageCenterScreen } from './MessageCenterPanel'
import { Spinner } from './Spinner'
import { AlertIcon, BriefcaseIcon, ChevronLeftIcon, LinkIcon, PlusIcon, UserIcon } from './Icons'

interface Props {
  chat: ActiveChat
  workspaceId: string
  userId: string
  /** Reporta o contato ativo (e um jeito de recarregá-lo) pro App.tsx, que
   * alimenta o menu "•••" no header — as ações desse menu (editar contato,
   * empresa) são do contato, mas o botão em si mora no header do app, um
   * nível acima de onde o lookup acontece. */
  onContactContextChange?: (ctx: { contact: LeadContact; chatPhone: string; workspaceId: string; userId: string; refetch: () => void } | null) => void
}

type LeadAction = 'new-opportunity' | 'new-contact' | 'link-opportunity' | null
type PanelTab = 'contexto' | 'atividades'

export function LeadPanel({ chat, userId, workspaceId, onContactContextChange }: Props) {
  const { loading, error, contact, opportunity, searched, refetch, invalidateAndRefetch } = useLeadLookup(chat.phone)
  const [action, setAction] = useState<LeadAction>(null)
  const [tab, setTab] = useState<PanelTab>('contexto')
  const [messageCenterOpen, setMessageCenterOpen] = useState(false)

  useEffect(() => {
    onContactContextChange?.(contact ? { contact, chatPhone: chat.phone, workspaceId, userId, refetch } : null)
    return () => onContactContextChange?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, refetch])

  function handleDone() {
    setAction(null)
    invalidateAndRefetch()
  }

  const isLead = contact?.contact_type === 'lead'
  // No Contexto, evita repetir a identidade já exibida no cadastro.
  // Diferenças entre WhatsApp e CRM continuam visíveis, sem perder dados.
  const showWhatsAppIdentity = tab === 'atividades' || !contact || !!error ||
    Boolean(chat.name && chat.name !== contact.name) ||
    (contact.phone !== chat.phone && contact.phone_e164 !== chat.phone)

  // Tela cheia — some com header de contato, abas Contexto/Atividades, tudo
  // (pedido explícito: "central de mensagens, nada mais"). Não depende do
  // lookup de lead (loading/searched) porque a Central de Mensagens em si
  // não precisa de contato nem oportunidade, só do chat ativo — dá pra abrir
  // até antes do lookup terminar.
  if (messageCenterOpen) {
    return <MessageCenterScreen context={{ scope: { userId, workspaceId }, chat, contact }} onClose={() => setMessageCenterOpen(false)} />
  }

  return (
    <div className="lead-panel">
      <MessageCenterToggle onClick={() => setMessageCenterOpen(true)} />
      {showWhatsAppIdentity && <header className="active-chat-header">
        <div className="active-chat-header-top">
          <span className="block-title">WhatsApp</span>
          <strong>{chat.name || chat.phone}</strong>
        </div>
        {chat.name && <span className="chat-phone">{chat.phone}</span>}
      </header>}

      {loading && <Spinner label="Buscando lead…" />}

      {/* Erro de verdade (rede/API) — nunca cai no estado "não encontrado" por engano */}
      {!loading && error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && searched && (
        <>
          {/* ── Central de Mensagens — acima das abas, sempre visível nesse
              chat (mesmo sem oportunidade vinculada, pedido explícito: ela
              não depende de oportunidade, só do chat ativo). Abre em tela
              cheia (ver early return acima). ── */}

          {/* ── Tabs: Contexto | Atividades ── */}
          <div className="panel-tabs">
            <button
              className={`panel-tab${tab === 'contexto' ? ' is-active' : ''}`}
              aria-pressed={tab === 'contexto'}
              onClick={() => setTab('contexto')}
            >
              Contexto
            </button>
            <button
              className={`panel-tab${tab === 'atividades' ? ' is-active' : ''}`}
              aria-pressed={tab === 'atividades'}
              onClick={() => setTab('atividades')}
            >
              Atividades
            </button>
          </div>

          {/* ── ABA CONTEXTO ── */}
          {tab === 'contexto' && (
            <div className="panel-tab-body">
              {contact && (
                <ContactInfo key={contact.id} contact={contact} onChanged={invalidateAndRefetch} />
              )}

              <div className="opportunity-section">
                <div className="opportunity-section-header">
                  {action ? (
                    <button className="back-button" onClick={() => setAction(null)}>
                      <ChevronLeftIcon size={13} /> Voltar
                    </button>
                  ) : (
                    <span className="block-title">Oportunidade</span>
                  )}
                  {!action && (
                    <div className="opportunity-section-actions">
                      {contact && !opportunity && (
                        <button className="link-button" onClick={() => setAction('link-opportunity')}>
                          <LinkIcon size={10} /> Vincular
                        </button>
                      )}
                      <button className="link-button opportunity-primary-action" onClick={() => setAction('new-opportunity')}>
                        <PlusIcon size={10} /> Nova
                      </button>
                    </div>
                  )}
                </div>

                {action === 'new-opportunity' && (
                  <CreateOpportunityForm
                    chat={chat}
                    existingContactId={contact?.id ?? null}
                    onCreated={handleDone}
                    onCancel={() => setAction(null)}
                  />
                )}
                {action === 'new-contact' && (
                  <SaveContactAction chat={chat} onSaved={handleDone} onCancel={() => setAction(null)} />
                )}
                {action === 'link-opportunity' && contact && (
                  <LinkExistingOpportunityForm contactId={contact.id} onLinked={handleDone} onCancel={() => setAction(null)} />
                )}

                {!action && (
                  <>
                    {/* Nada encontrado: nem contato, nem oportunidade */}
                    {!contact && (
                      <div className="opportunity-empty-state">
                        <BriefcaseIcon size={22} />
                        <p className="muted">Nenhum lead encontrado com esse telefone.</p>
                        <button className="secondary" onClick={() => setAction('new-contact')}>
                          Novo contato
                        </button>
                      </div>
                    )}

                    {/* Contato existe, sem oportunidade vinculada */}
                    {contact && !opportunity && (
                      <>
                        {isLead && (
                          <div className="alert-amber">
                            <AlertIcon size={13} />
                            <p>Lead sem oportunidade. Crie ou vincule uma oportunidade.</p>
                          </div>
                        )}
                        <div className="opportunity-empty-state">
                          <BriefcaseIcon size={22} />
                          <p className="muted">Nenhuma oportunidade vinculada</p>
                        </div>
                      </>
                    )}

                    {/* Oportunidade vinculada — bloco completo */}
                    {contact && opportunity && (
                      <OpportunityDetail
                        opportunity={opportunity}
                        workspaceId={workspaceId}
                        activeContact={contact}
                        onChanged={refetch}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── ABA ATIVIDADES ── */}
          {tab === 'atividades' && (
            <div className="panel-tab-body">
              {!opportunity ? (
                <div className="activities-empty-state">
                  <UserIcon size={28} className="activities-empty-icon" />
                  <p className="muted">Vincule uma oportunidade para gerenciar atividades</p>
                </div>
              ) : (
                <ActivitiesPanel
                  opportunityId={opportunity.id}
                  opportunityName={opportunity.name}
                  contactId={contact?.id ?? null}
                  contactName={contact?.name ?? null}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
