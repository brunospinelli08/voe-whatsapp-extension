// ScheduleVisitForm.tsx
// "Agendar visita" — cria uma task real (tabela `activities`, tipo
// 'visit') via POST /api/v1/tasks. Só usa due_date/due_time (é isso que o
// cron de lembretes em app.voeops.com/api/cron/task-reminders lê) +
// scheduled_at (timestamptz, pra qualquer view que espere isso).
//
// Nota: a rota /api/v1/tasks faz `insert({ ...body, workspace_id,
// created_by })` sem validar o corpo — os nomes de campo aqui têm que
// bater exatamente com as colunas reais de `activities` (conferido direto
// no Supabase via MCP, não no supabase/migration-v*.sql do repo, que
// estava desatualizado — a tabela evoluiu sem migração registrada).

import { FormEvent, useState } from 'react'
import { voeApi } from '../lib/apiClient'

interface Props {
  opportunityId: string
  contactId?: string | null
}

export function ScheduleVisitForm({ opportunityId, contactId }: Props) {
  const [scheduledAt, setScheduledAt] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!scheduledAt) return
    setSaving(true)
    setError(null)
    try {
      const date = new Date(scheduledAt)
      const dueDate = scheduledAt.slice(0, 10) // YYYY-MM-DD
      const dueTime = scheduledAt.slice(11, 16) // HH:mm

      await voeApi.post('/api/v1/tasks', {
        opportunity_id: opportunityId,
        contact_id: contactId ?? null,
        type: 'visit',
        title: 'Visita agendada via WhatsApp',
        description: description.trim() || null,
        due_date: dueDate,
        due_time: dueTime,
        scheduled_at: date.toISOString(),
      })

      setScheduledAt('')
      setDescription('')
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao agendar visita')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="schedule-visit-form" onSubmit={handleSubmit}>
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
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
      </label>

      <button type="submit" disabled={saving || !scheduledAt}>
        {saving ? 'Agendando…' : 'Agendar visita'}
      </button>
      {error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
      {savedAt && !error && <p className="success-text">Visita agendada.</p>}
    </form>
  )
}
