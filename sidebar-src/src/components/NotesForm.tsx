// NotesForm.tsx
import { FormEvent, useState } from 'react'
import { voeApi } from '../lib/apiClient'

interface Props {
  opportunityId: string
}

export function NotesForm({ opportunityId }: Props) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      await voeApi.post(`/api/v1/opportunities/${opportunityId}/notes`, { content })
      setContent('')
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar anotação')
    } finally {
      setSaving(false)
    }
  }

  return (
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
      {error && <p className="error-text">{error}</p>}
      {savedAt && !error && <p className="success-text">Anotação salva.</p>}
    </form>
  )
}
