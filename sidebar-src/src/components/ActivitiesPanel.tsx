// ActivitiesPanel.tsx
// Lista somente-leitura das atividades (visitas, reuniões, tarefas...) já
// registradas na oportunidade — mesma tabela/nomenclatura do dashboard real
// (ver ActivityCard.tsx em app.voeops.com).

import { useActivities } from '../hooks/useActivities'
import { Spinner } from './Spinner'

interface Props {
  opportunityId: string
}

// Nomenclatura idêntica à do dashboard (src/components/activities/ActivityCard.tsx)
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
  enviada: 'Enviada',
  entregue: 'Entregue',
  lida: 'Lida',
  respondida: 'Respondida',
  falhou: 'Falhou',
}

function formatWhen(dueDate: string | null, dueTime: string | null) {
  if (!dueDate) return null
  const date = new Date(`${dueDate.substring(0, 10)}T00:00:00`)
  const formatted = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  return dueTime ? `${formatted} · ${dueTime.substring(0, 5)}` : formatted
}

export function ActivitiesPanel({ opportunityId }: Props) {
  const { activities, loading, error } = useActivities(opportunityId)

  if (loading) return <Spinner label="Carregando atividades…" />

  if (error) {
    return (
      <div className="error-banner">
        <span>⚠</span>
        <span>{error}</span>
      </div>
    )
  }

  if (activities.length === 0) {
    return <p className="muted">Nenhuma atividade registrada nesta oportunidade ainda.</p>
  }

  return (
    <ul className="activities-list">
      {activities.map(activity => (
        <li key={activity.id} className="activity-item">
          <div className="activity-item-header">
            <span className="activity-type-badge">
              {TYPE_LABELS[activity.type] ?? activity.type}
            </span>
            <span className="muted">
              {STATUS_LABELS[activity.status] ?? activity.status}
            </span>
          </div>
          {activity.title && <p className="activity-title">{activity.title}</p>}
          {formatWhen(activity.due_date, activity.due_time) && (
            <p className="muted">{formatWhen(activity.due_date, activity.due_time)}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
