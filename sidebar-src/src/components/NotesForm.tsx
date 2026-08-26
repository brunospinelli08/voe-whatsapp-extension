// NotesForm.tsx
// Lista as anotações já existentes (useNotes.ts — antes a extensão só
// criava, nunca mostrava as que já existiam) + formulário de criação.

import { FormEvent, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { useNotes } from '../hooks/useNotes'
import { Spinner } from './Spinner'

interface Props {
  opportunityId: string
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function NotesForm({ opportunityId }: Props) {
  const { notes, loading, refetch } = useNotes(opportunityId)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      await voeApi.post(`/api/v1/opportunities/${opportunityId}/notes`, { content })
      setContent('')
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar anotação')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="notes-panel">
      {loading && <Spinner label="Carregando anotações…" />}

      {!loading && notes.length === 0 && (
        <p className="muted">Nenhuma anotação ainda.</p>
      )}

      {!loading && notes.length > 0 && (
        <ul className="notes-list">
          {notes.map(note => (
            <li key={note.id} className="note-item">
              {/* Mesma origem/confiança do conteúdo do dashboard (rich text
                  escrito por colegas do próprio workspace) — mesmo padrão
                  usado lá pra renderizar. */}
              <div className="note-content" dangerouslySetInnerHTML={{ __html: note.content }} />
              <p className="note-meta">
                {note.users?.full_name ?? 'Usuário'} · {fmtDateTime(note.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form className="notes-form" onSubmit={handleSubmit}>
        <label>
          Nova anotação
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            placeholder="O que aconteceu nessa conversa?"
          />
        </label>
        <button type="submit" disabled={saving || !content.trim()}>
          {saving ? 'Salvando…' : 'Salvar anotação'}
        </button>
        {error && (
          <div className="error-banner">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  )
}
