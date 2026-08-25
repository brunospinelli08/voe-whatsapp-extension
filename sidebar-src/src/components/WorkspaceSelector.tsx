// WorkspaceSelector.tsx
// Tela de seleção de workspace — aparece depois do login quando o usuário
// tem acesso a mais de um workspace na VOE (ou quando ele pede pra
// trocar). Sem isso, a extensão ficava usando silenciosamente qualquer
// workspace que estivesse ativo no dashboard, sem deixar claro qual.

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useWorkspaces } from '../hooks/useWorkspaces'

interface Props {
  user: User
  onSelect: (id: string, name: string) => Promise<void>
}

export function WorkspaceSelector({ user, onSelect }: Props) {
  const { workspaces, loading, error } = useWorkspaces(user)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [selectError, setSelectError] = useState<string | null>(null)

  // Só um workspace? Entra direto, sem exigir clique.
  useEffect(() => {
    if (!loading && workspaces.length === 1 && !selecting) {
      handleSelect(workspaces[0].id, workspaces[0].name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, workspaces])

  async function handleSelect(id: string, name: string) {
    setSelecting(id)
    setSelectError(null)
    try {
      await onSelect(id, name)
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : 'Erro ao selecionar workspace')
      setSelecting(null)
    }
  }

  if (loading || (workspaces.length === 1 && selecting)) {
    return (
      <div className="centered-message">
        <p className="muted">Carregando workspaces…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="centered-message">
        <p className="error-text">{error}</p>
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="centered-message">
        <p className="muted">Você não tem acesso a nenhum workspace na VOE ainda.</p>
      </div>
    )
  }

  return (
    <div className="workspace-selector">
      <h1>Escolha um workspace</h1>
      <p className="login-subtitle">Qual conta você quer usar aqui no WhatsApp?</p>

      <div className="workspace-list">
        {workspaces.map(ws => (
          <button
            key={ws.id}
            className="workspace-card"
            disabled={!!selecting}
            onClick={() => handleSelect(ws.id, ws.name)}
          >
            <span className="workspace-card-name">{ws.name}</span>
            <span className="workspace-card-role">{ws.role}</span>
          </button>
        ))}
      </div>

      {selectError && <p className="error-text">{selectError}</p>}
    </div>
  )
}
