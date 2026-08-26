// App.tsx
import { useAuth } from './hooks/useAuth'
import { useActiveChat } from './hooks/useActiveChat'
import { useActiveWorkspace } from './hooks/useActiveWorkspace'
import { LoginScreen } from './components/LoginScreen'
import { LeadPanel } from './components/LeadPanel'
import { WorkspaceSelector } from './components/WorkspaceSelector'
import { Spinner } from './components/Spinner'

const voeIconUrl = chrome.runtime.getURL('sidebar/voe-icon.png')

export function App() {
  const { session, loading, signIn, signOut } = useAuth()
  const chat = useActiveChat()
  const {
    activeWorkspace,
    loading: workspaceLoading,
    selectWorkspace,
    changeWorkspace,
  } = useActiveWorkspace()

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
        <button className="link-button" onClick={signOut}>
          Sair
        </button>
      </header>

      <main>
        {chat ? (
          <LeadPanel chat={chat} workspaceId={activeWorkspace.id} />
        ) : (
          <div className="empty-state">
            <p>Abra uma conversa individual no WhatsApp Web pra ver os dados do lead aqui.</p>
          </div>
        )}
      </main>
    </div>
  )
}
