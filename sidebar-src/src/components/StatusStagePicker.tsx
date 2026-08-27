// StatusStagePicker.tsx
// Duas dropdowns lado a lado — Status geral | Etapa do funil — mesma dupla
// que ContextPanel.tsx mostra logo abaixo do nome da oportunidade.
// Substitui StatusActions.tsx (lista vertical de botões) e
// StageSelector.tsx (select solto) da rodada anterior, que ficavam dentro
// do menu de ações — aqui os dois viram uma dupla sempre visível, como no
// painel real.
//
// Decisão consciente de escopo: no dashboard real, escolher "Vendido"
// nessa dropdown abre o WonLostModal (produtos, unidade, confirmação) e
// "Pausado" abre o PauseModal (motivo). Replicar os dois modais inteiros
// fica fora desta rodada — aqui a confirmação é direta (mesmo
// comportamento que StatusActions.tsx já tinha), só "Perdido" continua
// pedindo o motivo (useLossReasons), porque isso já existia e é barato.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { useLossReasons } from '../hooks/useLossReasons'
import { ChevronDownIcon } from './Icons'

interface Stage {
  id: string
  name: string
  order: number
  color?: string
}
interface Pipeline {
  id: string
  pipeline_stages: Stage[]
}

const STATUSES = [
  { value: 'active', label: 'Em andamento' },
  { value: 'won', label: 'Vendido' },
  { value: 'lost', label: 'Perdido' },
  { value: 'paused', label: 'Pausado' },
]

interface Props {
  opportunityId: string
  workspaceId: string
  pipelineId: string | null
  currentStageId: string
  currentStatus: string
  onChanged: () => void
}

export function StatusStagePicker({
  opportunityId, workspaceId, pipelineId, currentStageId, currentStatus, onChanged,
}: Props) {
  const [stages, setStages] = useState<Stage[]>([])
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingStage, setSavingStage] = useState(false)
  const [pickingLossReason, setPickingLossReason] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { reasons: lossReasons } = useLossReasons(workspaceId)

  useEffect(() => {
    voeApi
      .get<{ data: Pipeline[] }>('/api/v1/pipelines')
      .then(res => {
        const pipeline = res.data.find(p => p.id === pipelineId) ?? res.data[0]
        setStages([...(pipeline?.pipeline_stages ?? [])].sort((a, b) => a.order - b.order))
      })
      .catch(() => setStages([]))
  }, [pipelineId])

  async function updateStatus(status: string, lostReason?: string) {
    setSavingStatus(true)
    setError(null)
    try {
      await voeApi.put(`/api/v1/opportunities/${opportunityId}/status`, { status, lost_reason: lostReason })
      setPickingLossReason(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setSavingStatus(false)
    }
  }

  function handleStatusChange(value: string) {
    if (value === currentStatus) return
    if (value === 'lost') {
      setPickingLossReason(true)
      return
    }
    updateStatus(value)
  }

  async function handleStageChange(stageId: string) {
    if (stageId === currentStageId) return
    setSavingStage(true)
    setError(null)
    try {
      await voeApi.put(`/api/v1/opportunities/${opportunityId}/stage`, { stage_id: stageId })
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao mover etapa')
    } finally {
      setSavingStage(false)
    }
  }

  if (pickingLossReason) {
    return (
      <div className="status-actions">
        <p className="muted">Motivo da perda:</p>
        {lossReasons.length === 0 ? (
          <button disabled={savingStatus} onClick={() => updateStatus('lost')}>
            Confirmar perda (sem motivo cadastrado)
          </button>
        ) : (
          <div className="status-actions-buttons">
            {lossReasons.map(reason => (
              <button key={reason.id} className="secondary" disabled={savingStatus} onClick={() => updateStatus('lost', reason.label)}>
                {reason.label}
              </button>
            ))}
          </div>
        )}
        <button className="secondary" disabled={savingStatus} onClick={() => setPickingLossReason(false)}>
          Cancelar
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  return (
    <div className="status-stage-row">
      <div className={`status-stage-select-wrap status-${currentStatus}`}>
        <select
          className="status-stage-select"
          value={currentStatus}
          disabled={savingStatus}
          onChange={e => handleStatusChange(e.target.value)}
        >
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <ChevronDownIcon className="status-stage-chevron" />
      </div>
      <div className="status-stage-select-wrap">
        <select
          className="status-stage-select"
          value={currentStageId}
          disabled={savingStage || stages.length === 0}
          onChange={e => handleStageChange(e.target.value)}
        >
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <ChevronDownIcon className="status-stage-chevron" />
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
