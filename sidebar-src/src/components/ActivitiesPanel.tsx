// ActivitiesPanel.tsx
// Aba "Atividades" — lista as atividades já registradas na oportunidade
// (mesma tabela/nomenclatura do dashboard real, ver ActivityCard.tsx em
// app.voeops.com) + "+ Nova atividade". Estado vazio (ícone + texto +
// botão) espelha exatamente o `panelTab === 1` de inbox/page.tsx.
//
// Decisão consciente de escopo: o botão "+ Nova atividade" do dashboard
// real abre um modal genérico (ActivityModal, tipos task/call/email/
// meeting/visit). Aqui ele abre o ScheduleVisitForm que a extensão já
// tinha (POST /api/v1/tasks, type: 'visit') — cobre o caso de uso
// principal do segmento (agendar visita), mas só cria atividades desse
// tipo; não é um formulário genérico de qualquer tipo de atividade.

import { useState } from 'react'
import { useActivities } from '../hooks/useActivities'
import { ScheduleVisitForm } from './ScheduleVisitForm'
import { CalendarClockIcon, PlusIcon } from './Icons'
import { Spinner } from './Spinner'

interface Props {
  opportunityId: string
  contactId: string | null
}

const TYPE_LABELS: Record<string, string> = {
  task: 'Tarefa',
  whatsapp: 'WhatsApp',
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  visit: 'Visita',
}

const STATUS_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  pending: 'Pendente',
  paused: 'Pausada',
}

function formatWhen(dueDate: string | null, dueTime: string | null) {
  if (!dueDate) return null
  const date = new Date(`${dueDate.substring(0, 10)}T00:00:00`)
  const formatted = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  return dueTime ? `${formatted} · ${dueTime.substring(0, 5)}` : formatted
}

export function ActivitiesPanel({ opportunityId, contactId }: Props) {
  const { activities, loading, error, refetch } = useActivities(opportunityId)
  const [showForm, setShowForm] = useState(false)

  if (loading) return <Spinner label="Carregando atividades…" />

  if (error) {
    return (
      <div className="error-banner">
        <span>⚠</span>
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="activities-panel">
      {activities.length === 0 && !showForm && (
        <div className="activities-empty-state">
          <CalendarClockIcon size={28} className="activities-empty-icon" />
          <p className="muted">Nenhuma atividade ainda</p>
        </div>
      )}

      {activities.length > 0 && (
        <ul className="activities-list">
          {activities.map(activity => (
            <li key={activity.id} className="activity-item">
              <div className="activity-item-header">
                <span className="activity-type-badge">{TYPE_LABELS[activity.type] ?? activity.type}</span>
                <span className="muted">{STATUS_LABELS[activity.status] ?? activity.status}</span>
              </div>
              {activity.title && <p className="activity-title">{activity.title}</p>}
              {formatWhen(activity.due_date, activity.due_time) && (
                <p className="muted">{formatWhen(activity.due_date, activity.due_time)}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="activities-new-form">
          <ScheduleVisitForm
            opportunityId={opportunityId}
            contactId={contactId}
          />
          <button className="secondary" onClick={() => { setShowForm(false); refetch() }}>
            Fechar
          </button>
        </div>
      ) : (
        <button className="new-activity-btn" onClick={() => setShowForm(true)}>
          <PlusIcon size={12} /> Nova atividade
        </button>
      )}
    </div>
  )
}
