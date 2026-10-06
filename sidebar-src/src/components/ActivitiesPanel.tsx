// ActivitiesPanel.tsx
// Aba "Atividades" — espelha o `panelTab === 1` de inbox/page.tsx do
// dashboard: atividades agendadas no topo (ActivityCard compacto), as
// demais colapsadas em "N concluída(s)", e "+ Nova atividade" no fim, que
// abre o NewActivityModal.tsx (réplica do ActivityModal.tsx real).
// Ações dos cards = handleActivityAction do Inbox (concluir, cancelar,
// reativar, enviar agora) + adiar/excluir.

import { useState } from 'react'
import { useActivities } from '../hooks/useActivities'
import { ActivityCard, type ActivityAction } from './ActivityCard'
import { NewActivityModal } from './NewActivityModal'
import { CalendarClockIcon, PlusIcon } from './Icons'
import { Spinner } from './Spinner'

interface Props {
  opportunityId: string
  opportunityName: string
  contactId: string | null
  contactName: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  companyName?: string | null
}

export function ActivitiesPanel({ opportunityId, opportunityName, contactId, contactName, contactPhone, contactEmail, companyName }: Props) {
  const {
    activities, loading, error, refetch,
    completeActivity, cancelActivity, reactivateActivity, postponeActivity, deleteActivity, sendNowActivity,
  } = useActivities(opportunityId)
  const [showModal, setShowModal] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function guarded(fn: () => Promise<void>) {
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao atualizar atividade')
      refetch()
    }
  }

  const handleAction = (id: string, action: ActivityAction, result?: string) => guarded(async () => {
    switch (action) {
      case 'complete': await completeActivity(id, result ?? 'feita'); break
      case 'cancel': await cancelActivity(id); break
      case 'reactivate': await reactivateActivity(id); break
      case 'send_now': await sendNowActivity(id); break
    }
  })

  if (loading && activities.length === 0) return <Spinner label="Carregando atividades…" />

  if (error) {
    return (
      <div className="error-banner">
        <span>⚠</span>
        <span>{error}</span>
      </div>
    )
  }

  const pending = activities.filter(a => a.status === 'agendada')
  const done = activities.filter(a => a.status !== 'agendada')

  return (
    <div className="activities-panel">
      {activities.length === 0 && (
        <div className="activities-empty-state">
          <CalendarClockIcon size={28} className="activities-empty-icon" />
          <p className="muted">Nenhuma atividade ainda</p>
        </div>
      )}

      {pending.map(activity => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onAction={handleAction}
          onPostpone={(id, d, t) => guarded(() => postponeActivity(id, d, t))}
          onDelete={id => guarded(() => deleteActivity(id))}
        />
      ))}

      {done.length > 0 && (
        <details className="activities-done">
          <summary>{done.length} concluída{done.length > 1 ? 's' : ''}</summary>
          <div className="activities-done-list">
            {done.map(activity => (
              <ActivityCard key={activity.id} activity={activity} onAction={handleAction} />
            ))}
          </div>
        </details>
      )}

      {actionError && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{actionError}</span>
        </div>
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
          contactPhone={contactPhone}
          contactEmail={contactEmail}
          companyName={companyName}
          onClose={() => setShowModal(false)}
          onCreated={refetch}
        />
      )}
    </div>
  )
}
