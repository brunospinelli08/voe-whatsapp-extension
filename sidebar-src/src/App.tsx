// App.tsx
import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useActiveChat } from './hooks/useActiveChat'
import { useActiveWorkspace } from './hooks/useActiveWorkspace'
import { LoginScreen } from './components/LoginScreen'
import { LeadPanel } from './components/LeadPanel'
import { WorkspaceSelector } from './components/WorkspaceSelector'
import { Spinner } from './components/Spinner'
import { ContactActionsMenu } from './components/ContactActionsMenu'
import { ThemeToggle } from './components/ThemeToggle'
import type { LeadContact } from './hooks/useLeadLookup'

const voeIconUrl = chrome.runtime.getURL('sidebar/voe-icon.png')

export function App() {
  const { session, loading, signIn, signOut } = useAuth()
  const chat = useActiveChat()
  // Contato ativo (+ refetch), reportado pelo LeadPanel — alimenta o menu
  // "•••" do header (ver ContactActionsMenu.tsx / nota em LeadPanel.tsx).
  const [contactCtx, setContactCtx] = useState<{ contact: LeadContact; chatPhone: string; workspaceId: string; userId: string; refetch: () => void } | null>(null)
  const {
    activeWorkspace,
    loading: workspaceLoading,
    selectWorkspace,
    changeWorkspace,
  } = useActiveWorkspace(session?.user.id ?? null)

  useEffect(() => {
    const context = !loading && !workspaceLoading && session && activeWorkspace ? {
      scope: { userId: session.user.id, workspaceId: activeWorkspace.id }, chat,
      contact: contactCtx?.chatPhone === chat?.phone && contactCtx?.workspaceId === activeWorkspace.id && contactCtx?.userId === session.user.id ? contactCtx.contact : null,
    } : null
    const sendContext = () => window.parent.postMessage({ type: 'VOE_CENTER_CONTEXT', context }, '*')
    function onMessage(event: MessageEvent) {
      if (event.source === window.parent && event.data?.type === 'VOE_REQUEST_CENTER_CONTEXT') sendContext()
    }
    sendContext()
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [loading, workspaceLoading, session, activeWorkspace, chat, contactCtx])

  if (loading || (session && workspaceLoading)) {
    return (
      <div className="centered-message">
        <Spinner label="Carregando…" />
      </div>
    )
  }

  if (!session) {
    return <><div className="theme-toolbar"><ThemeToggle /></div><LoginScreen onSignIn={signIn} /></>
  }

  if (!activeWorkspace) {
    return <><div className="theme-toolbar"><ThemeToggle /></div><WorkspaceSelector user={session.user} onSelect={selectWorkspace} /></>
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
        <div className="app-header-actions">
          <ThemeToggle />
          <ContactActionsMenu
          contact={contactCtx?.contact ?? null}
          onContactChanged={() => contactCtx?.refetch()}
          onSignOut={signOut}
          />
        </div>
      </header>

      <main>
        {chat ? (
          // key={chat.phone}: remonta o painel ao trocar de conversa — sem
          // isso, o estado "escolhi criar oportunidade" de um chat vazava
          // pro próximo chat aberto.
          <LeadPanel key={`${session.user.id}:${activeWorkspace.id}:${chat.phone}`} chat={chat} userId={session.user.id} workspaceId={activeWorkspace.id} onContactContextChange={setContactCtx} />
        ) : (
          <div className="empty-state">
            <p>Abra uma conversa individual no WhatsApp Web pra ver os dados do lead aqui.</p>
          </div>
        )}
      </main>
    </div>
  )
}
