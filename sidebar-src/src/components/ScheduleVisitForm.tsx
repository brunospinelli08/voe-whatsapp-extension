// ScheduleVisitForm.tsx
// "Agendar visita" — hoje o backend não tem um domínio de agenda de verdade
// (sem lembrete, sem calendário). Isso registra a intenção como uma
// activity tipo 'meeting' na timeline da oportunidade (POST /api/v1/tasks,
// que insere em `activities`), com data/hora combinada dentro do texto —
// não é um agendamento de verdade, é um log. Deixamos isso explícito na UI
// pra não passar a falsa impressão de que existe lembrete/notificação por
// trás. Quando a VOE tiver um domínio de Agenda de verdade, isso deve virar
// uma chamada pra lá em vez de uma activity solta.

import { FormEvent, useState } from 'react'
import { voeApi } from '../lib/apiClient'

interface Props {
  opportunityId: string
}

export function ScheduleVisitForm({ opportunityId }: Props) {
  const [scheduledAt, setScheduledAt] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!scheduledAt) return
    setSaving(true)
    setError(null)
    try {
      const formattedDate = new Date(scheduledAt).toLocaleString('pt-BR')
      const content = note.trim()
        ? `Visita agendada para ${formattedDate}. ${note.trim()}`
        : `Visita agendada para ${formattedDate}.`

      await voeApi.post('/api/v1/tasks', {
        opportunity_id: opportunityId,
        type: 'meeting',
        content,
        metadata: { scheduled_at: new Date(scheduledAt).toISOString(), source: 'whatsapp_extension' },
      })

      setScheduledAt('')
      setNote('')
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar visita')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="schedule-visit-form" onSubmit={handleSubmit}>
      <p className="muted schedule-visit-disclaimer">
        Isso só registra a visita na timeline do lead — ainda não existe lembrete/calendário de
        verdade por trás.
      </p>

      <label>
        Data e hora da visita
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          required
        />
      </label>

      <label>
        Observação (opcional)
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} />
      </label>

      <button type="submit" disabled={saving || !scheduledAt}>
        {saving ? 'Registrando…' : 'Registrar visita'}
      </button>
      {error && <p className="error-text">{error}</p>}
      {savedAt && !error && <p className="success-text">Visita registrada na timeline.</p>}
    </form>
  )
}
