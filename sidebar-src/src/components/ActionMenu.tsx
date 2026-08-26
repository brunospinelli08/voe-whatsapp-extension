// ActionMenu.tsx
// "O que você quer fazer?" — versão compacta, pro espaço estreito da
// sidebar, das ações reais da tela de Oportunidades do app.voeops.com
// (mover etapa, anotação, agendar visita, marcar vendido/perdido/pausado,
// ver atividades). Só um painel aberto por vez, em vez de empilhar todos
// os formulários.

import { useState } from 'react'
import { StageSelector } from './StageSelector'
import { NotesForm } from './NotesForm'
import { ScheduleVisitForm } from './ScheduleVisitForm'
import { StatusActions } from './StatusActions'
import { ActivitiesPanel } from './ActivitiesPanel'
import { MessageLibraryPanel } from './MessageLibraryPanel'

type ActionKey = 'stage' | 'note' | 'visit' | 'status' | 'activities' | 'messages'

interface Props {
  opportunityId: string
  workspaceId: string
  pipelineId: string | null
  currentStageId: string
  currentStatus: string
  contactId: string | null
  onChanged: () => void
}

const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: 'stage', label: 'Mover etapa do funil' },
  { key: 'note', label: 'Criar anotação' },
  { key: 'visit', label: 'Agendar visita' },
  { key: 'status', label: 'Marcar Vendido / Perdido / Pausar' },
  { key: 'activities', label: 'Ver atividades' },
  { key: 'messages', label: 'Modelos de mensagens' },
]

export function ActionMenu({
  opportunityId,
  workspaceId,
  pipelineId,
  currentStageId,
  currentStatus,
  contactId,
  onChanged,
}: Props) {
  const [open, setOpen] = useState<ActionKey | null>(null)

  function toggle(key: ActionKey) {
    setOpen(current => (current === key ? null : key))
  }

  function handleChanged() {
    onChanged()
    setOpen(null)
  }

  return (
    <div className="action-menu">
      <p className="action-menu-title">O que você quer fazer?</p>

      {ACTIONS.map(action => (
        <div key={action.key}>
          <button className="action-menu-item" onClick={() => toggle(action.key)}>
            <span>{action.label}</span>
            <span aria-hidden>{open === action.key ? '−' : '+'}</span>
          </button>

          {open === action.key && (
            <div className="action-panel">
              {action.key === 'stage' && (
                <StageSelector
                  opportunityId={opportunityId}
                  currentStageId={currentStageId}
                  pipelineId={pipelineId}
                  onMoved={handleChanged}
                />
              )}
              {action.key === 'note' && <NotesForm opportunityId={opportunityId} />}
              {action.key === 'visit' && (
                <ScheduleVisitForm opportunityId={opportunityId} contactId={contactId} />
              )}
              {action.key === 'status' && (
                <StatusActions
                  opportunityId={opportunityId}
                  workspaceId={workspaceId}
                  currentStatus={currentStatus}
                  onChanged={handleChanged}
                />
              )}
              {action.key === 'activities' && <ActivitiesPanel opportunityId={opportunityId} />}
              {action.key === 'messages' && <MessageLibraryPanel />}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
