// ActivitiesPanel.tsx
// Aba "Atividades" — lista as atividades já registradas na oportunidade
// (mesma tabela/nomenclatura do dashboard real, ver ActivityCard.tsx em
// app.voeops.com) + "+ Nova atividade", que abre o NewActivityModal.tsx
// (réplica do ActivityModal.tsx real). Estado vazio (ícone + texto +
// botão) espelha exatamente o `panelTab === 1` de inbox/page.tsx.

import { useState } from 'react'
import { useActivities } from '../hooks/useActivities'
import { NewActivityModal } from './NewActivityModal'
import { CalendarClockIcon, PlusIcon } from './Icons'
import { Spinner } from './Spinner'

interface Props {
  opportunityId: string
  opportunityName: string
  contactId: string | null
  contactName: string | null
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
  // "pending" é o default legado da coluna no banco — não deveria aparecer
  // em atividades novas (o modal sempre manda status: "agendada" agora),
  // mas atividades antigas criadas antes dessa correção ainda têm isso.
  pending: 'Pendente',
  paused: 'Pausada',
}

function formatWhen(dueDate: string | null, dueTime: string | null) {
  if (!dueDate) return null
  const date = new Date(`${dueDate.substring(0, 10)}T00:00:00`)
  const formatted = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  return dueTime ? `${formatted} · ${dueTime.substring(0, 5)}` : formatted
}

export function ActivitiesPanel({ opportunityId, opportunityName, contactId, contactName }: Props) {
  const { activities, loading, error, refetch } = useActivities(opportunityId)
  const [showModal, setShowModal] = useState(false)

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
      {activities.length === 0 && (
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

      <button className="new-activity-btn" onClick={() => setShowModal(true)}>
        <PlusIcon size={12} /> Nova atividade
      </button>

      {showModal && (
        <NewActivityModal
          opportunityId={opportunityId}
          opportunityName={opportunityName}
          contactId={contactId}
          contactName={contactName}
          onClose={() => setShowModal(false)}
          onCreated={refetch}
        />
      )}
    </div>
  )
}
