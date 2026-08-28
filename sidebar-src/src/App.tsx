// App.tsx
import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useActiveChat } from './hooks/useActiveChat'
import { useActiveWorkspace } from './hooks/useActiveWorkspace'
import { LoginScreen } from './components/LoginScreen'
import { LeadPanel } from './components/LeadPanel'
import { WorkspaceSelector } from './components/WorkspaceSelector'
import { Spinner } from './components/Spinner'
import { ContactActionsMenu } from './components/ContactActionsMenu'
import type { LeadContact } from './hooks/useLeadLookup'

const voeIconUrl = chrome.runtime.getURL('sidebar/voe-icon.png')

export function App() {
  const { session, loading, signIn, signOut } = useAuth()
  const chat = useActiveChat()
  // Contato ativo (+ refetch), reportado pelo LeadPanel — alimenta o menu
  // "•••" do header (ver ContactActionsMenu.tsx / nota em LeadPanel.tsx).
  const [contactCtx, setContactCtx] = useState<{ contact: LeadContact; refetch: () => void } | null>(null)
  const {
    activeWorkspace,
    loading: workspaceLoading,
    selectWorkspace,
    changeWorkspace,
  } = useActiveWorkspace(session?.user.id ?? null)

  if (loading || (session && workspaceLoading)) {
    return (
      <div className="centered-message">
        <Spinner label="Carregando…" />
      </div>
    )
  }

  if (!session) {
    return <LoginScreen onSignIn={signIn} />
  }

  if (!activeWorkspace) {
    return <WorkspaceSelector user={session.user} onSelect={selectWorkspace} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <img src={voeIconUrl} alt="" className="app-header-logo" />
          <div className="app-header-text">
            <span className="app-header-title">VOE — Atendimento</span>
            <button className="link-button workspace-name" onClick={changeWorkspace} title="Trocar workspace">
              {activeWorkspace.name} · trocar
            </button>
          </div>
        </div>
        <ContactActionsMenu
          contact={contactCtx?.contact ?? null}
          onContactChanged={() => contactCtx?.refetch()}
          onSignOut={signOut}
        />
      </header>

      <main>
        {chat ? (
          // key={chat.phone}: remonta o painel ao trocar de conversa — sem
          // isso, o estado "escolhi criar oportunidade" de um chat vazava
          // pro próximo chat aberto.
          <LeadPanel key={chat.phone} chat={chat} workspaceId={activeWorkspace.id} onContactContextChange={setContactCtx} />
        ) : (
          <div className="empty-state">
            <p>Abra uma conversa individual no WhatsApp Web pra ver os dados do lead aqui.</p>
          </div>
        )}
      </main>
    </div>
  )
}
