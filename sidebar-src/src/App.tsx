// App.tsx
import { useAuth } from './hooks/useAuth'
import { useActiveChat } from './hooks/useActiveChat'
import { useActiveWorkspace } from './hooks/useActiveWorkspace'
import { LoginScreen } from './components/LoginScreen'
import { LeadPanel } from './components/LeadPanel'
import { WorkspaceSelector } from './components/WorkspaceSelector'

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
        <p className="muted">Carregando…</p>
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
        <div className="app-header-workspace">
          <span>VOE — Atendimento</span>
          <button className="link-button workspace-name" onClick={changeWorkspace}>
            {activeWorkspace.name} · trocar
          </button>
        </div>
        <button className="link-button" onClick={signOut}>
          Sair
        </button>
      </header>

      <main>
        {chat ? (
          <LeadPanel chat={chat} />
        ) : (
          <div className="empty-state">
            <p>Abra uma conversa individual no WhatsApp Web pra ver os dados do lead aqui.</p>
          </div>
        )}
      </main>
    </div>
  )
}
