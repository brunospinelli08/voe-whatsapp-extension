// ContactActionsMenu.tsx
// Botão "•••" no lugar onde antes ficava o "Sair" isolado — abre um menu
// flutuante ancorado nele, mesmo padrão hand-rolled (ref + clique fora +
// Esc) que o dashboard real usa em menus de contexto (ver
// ConversationContextMenu.tsx: não existe um componente de dropdown
// genérico compartilhado no design system de lá, cada menu é construído à
// mão do mesmo jeito — replicado aqui, não inventado).
//
// Itens contact-scoped (Editar contato/Desassociar/Criar empresa/Associar
// empresa) ficam desabilitados quando não há contato ativo (chat sem lead
// encontrado, ou nenhum chat aberto) — "Sair" continua sempre disponível,
// é ação de sessão, não do contato.

import { useEffect, useRef, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import type { LeadContact } from '../hooks/useLeadLookup'
import { EditContactModal } from './EditContactModal'
import { CreateCompanyModal } from './CreateCompanyModal'
import { AssociateCompanyModal } from './AssociateCompanyModal'
import { MoreHorizontalIcon, PencilIcon, UnlinkIcon, Building2Icon, LinkIcon, LogOutIcon } from './Icons'

type ModalKey = 'edit' | 'create-company' | 'associate-company' | null

interface Props {
  contact: LeadContact | null
  onContactChanged: () => void
  onSignOut: () => void
}

export function ContactActionsMenu({ contact, onContactChanged, onSignOut }: Props) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<ModalKey>(null)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function openModal(key: ModalKey) {
    setOpen(false)
    setModal(key)
  }

  async function handleUnlinkCompany() {
    if (!contact) return
    setOpen(false)
    setUnlinking(true)
    setError(null)
    try {
      await voeApi.put(`/api/v1/contacts/${contact.id}`, { company_id: null })
      onContactChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desassociar empresa')
    } finally {
      setUnlinking(false)
    }
  }

  const hasContact = !!contact
  const hasCompany = !!contact?.company_id

  return (
    <>
      <div className="header-menu" ref={menuRef}>
        <button
          type="button"
          className="header-menu-trigger"
          onClick={() => setOpen(v => !v)}
          title="Mais ações"
          aria-label="Mais ações"
        >
          <MoreHorizontalIcon size={18} />
        </button>

        {open && (
          <div className="header-menu-dropdown">
            <button type="button" disabled={!hasContact} onClick={() => openModal('edit')}>
              <PencilIcon size={13} /> Editar contato
            </button>
            <button type="button" disabled={!hasContact || !hasCompany || unlinking} onClick={handleUnlinkCompany}>
              <UnlinkIcon size={13} /> {unlinking ? 'Desassociando…' : 'Desassociar empresa'}
            </button>
            <button type="button" disabled={!hasContact} onClick={() => openModal('create-company')}>
              <Building2Icon size={13} /> Criar empresa
            </button>
            <button type="button" disabled={!hasContact} onClick={() => openModal('associate-company')}>
              <LinkIcon size={13} /> Associar empresa
            </button>
            <div className="header-menu-separator" />
            <button type="button" className="header-menu-danger" onClick={onSignOut}>
              <LogOutIcon size={13} /> Sair
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="header-menu-error error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {modal === 'edit' && contact && (
        <EditContactModal contact={contact} onClose={() => setModal(null)} onSaved={onContactChanged} />
      )}
      {modal === 'create-company' && contact && (
        <CreateCompanyModal contact={contact} onClose={() => setModal(null)} onCreated={onContactChanged} />
      )}
      {modal === 'associate-company' && contact && (
        <AssociateCompanyModal contact={contact} onClose={() => setModal(null)} onLinked={onContactChanged} />
      )}
    </>
  )
}
