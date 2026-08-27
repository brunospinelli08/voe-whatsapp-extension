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
import { ContactTagsEditor } from './ContactTagsEditor'
import { ActivitiesPanel } from './ActivitiesPanel'
import { MessageLibraryPanel } from './MessageLibraryPanel'
import { Spinner } from './Spinner'
import { AlertIcon, BriefcaseIcon, Building2Icon, ChevronLeftIcon, LinkIcon, PlusIcon, PhoneIcon, MailIcon, UserIcon } from './Icons'

interface Props {
  chat: ActiveChat
  workspaceId: string
  /** Reporta o contato ativo (e um jeito de recarregá-lo) pro App.tsx, que
   * alimenta o menu "•••" no header — as ações desse menu (editar contato,
   * empresa) são do contato, mas o botão em si mora no header do app, um
   * nível acima de onde o lookup acontece. */
  onContactContextChange?: (ctx: { contact: LeadContact; refetch: () => void } | null) => void
}

type LeadAction = 'new-opportunity' | 'new-contact' | 'link-opportunity' | null
type PanelTab = 'contexto' | 'atividades'

export function LeadPanel({ chat, workspaceId, onContactContextChange }: Props) {
  const { loading, error, contact, opportunity, searched, refetch } = useLeadLookup(chat.phone)
  const [action, setAction] = useState<LeadAction>(null)
  const [tab, setTab] = useState<PanelTab>('contexto')
  const [showMessages, setShowMessages] = useState(false)

  useEffect(() => {
    onContactContextChange?.(contact ? { contact, refetch } : null)
    return () => onContactContextChange?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, refetch])

  function handleDone() {
    setAction(null)
    refetch()
  }

  const isLead = contact?.contact_type === 'lead'

  return (
    <div className="lead-panel">
      <header className="active-chat-header">
        <div className="active-chat-header-top">
          <strong>{chat.name || chat.phone}</strong>
          <button className="link-button messages-toggle" onClick={() => setShowMessages(v => !v)}>
            Modelos de mensagens
          </button>
        </div>
        {chat.name && <span className="chat-phone">{chat.phone}</span>}
      </header>

      {showMessages && (
        <div className="messages-panel-inline">
          <MessageLibraryPanel />
        </div>
      )}

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
          {/* ── Tabs: Contexto | Atividades ── */}
          <div className="panel-tabs">
            <button
              className={`panel-tab${tab === 'contexto' ? ' is-active' : ''}`}
              onClick={() => setTab('contexto')}
            >
              Contexto
            </button>
            <button
              className={`panel-tab${tab === 'atividades' ? ' is-active' : ''}`}
              onClick={() => setTab('atividades')}
            >
              Atividades
            </button>
          </div>

          {/* ── ABA CONTEXTO ── */}
          {tab === 'contexto' && (
            <div className="panel-tab-body">
              {contact && (
                <div className="contact-header-block">
                  <div className="contact-header-row">
                    <span className="contact-name">{contact.name || chat.phone}</span>
                    <span className="contact-role">
                      {contact.role_title ? contact.role_title : <em>Cargo: Não definido</em>}
                    </span>
                  </div>
                  <div className="contact-meta-row">
                    {contact.phone && (
                      <span className="contact-meta"><PhoneIcon size={11} /> {contact.phone}</span>
                    )}
                    {contact.email && (
                      <span className="contact-meta"><MailIcon size={11} /> {contact.email}</span>
                    )}
                  </div>
                  {contact.company?.name && (
                    <p className="contact-company">
                      <Building2Icon size={10} /> {contact.company.name}
                    </p>
                  )}
                  <ContactTagsEditor contact={contact} onChanged={refetch} />
                </div>
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
