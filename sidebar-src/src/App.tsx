// App.tsx
import { useAuth } from './hooks/useAuth'
import { useActiveChat } from './hooks/useActiveChat'
import { LoginScreen } from './components/LoginScreen'
import { LeadPanel } from './components/LeadPanel'

export function App() {
  const { session, loading, signIn, signOut } = useAuth()
  const chat = useActiveChat()

  if (loading) {
    return (
      <div className="centered-message">
        <p className="muted">Carregando…</p>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen onSignIn={signIn} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span>VOE — Atendimento</span>
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
