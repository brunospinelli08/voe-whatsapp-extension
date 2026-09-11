// StatusStagePicker.tsx
// Duas dropdowns lado a lado — Status geral | Etapa do funil — mesma dupla
// que ContextPanel.tsx mostra logo abaixo do nome da oportunidade.

import { useEffect, useRef, useState } from 'react'
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
  name: string
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
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [viewedPipelineId, setViewedPipelineId] = useState(pipelineId)
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingStage, setSavingStage] = useState(false)
  const [pickingLossReason, setPickingLossReason] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { reasons: lossReasons } = useLossReasons(workspaceId)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    let mounted = true
    voeApi
      .get<{ data: Pipeline[] }>('/api/v1/pipelines')
      .then(res => { if (mounted) setPipelines(res.data) })
      .catch(() => { if (mounted) setPipelines([]) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    setViewedPipelineId(pipelineId)
  }, [pipelineId])

  const viewedPipeline = pipelines.find(p => p.id === viewedPipelineId) ?? pipelines[0]
  const stages = [...(viewedPipeline?.pipeline_stages ?? [])].sort((a, b) => a.order - b.order)
  const switchingPipeline = viewedPipelineId !== pipelineId

  async function updateStatus(status: string, lostReason?: string) {
    setSavingStatus(true)
    setError(null)
    try {
      await voeApi.put(`/api/v1/opportunities/${opportunityId}/status`, { status, lost_reason: lostReason })
      if (mountedRef.current) {
        setPickingLossReason(false)
        onChanged()
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      if (mountedRef.current) setSavingStatus(false)
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
      if (mountedRef.current) onChanged()
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Erro ao mover etapa')
    } finally {
      if (mountedRef.current) setSavingStage(false)
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
    <div className="status-stage-panel">
      {pipelines.length > 1 && (
        <div className="status-stage-select-wrap">
          <select
            className="status-stage-select"
            value={viewedPipelineId ?? pipelines[0]?.id ?? ''}
            onChange={e => setViewedPipelineId(e.target.value)}
          >
            {pipelines.map(p => {
              const isEmpty = p.pipeline_stages.length === 0
              return (
                <option key={p.id} value={p.id} disabled={isEmpty}>
                  {p.name}{isEmpty ? ' (sem etapas)' : ''}
                </option>
              )
            })}
          </select>
          <ChevronDownIcon className="status-stage-chevron" />
        </div>
      )}

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
            value={stages.some(s => s.id === currentStageId) ? currentStageId : ''}
            disabled={savingStage || stages.length === 0}
            onChange={e => handleStageChange(e.target.value)}
          >
            {switchingPipeline && <option value="" disabled>Escolha a etapa…</option>}
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDownIcon className="status-stage-chevron" />
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
