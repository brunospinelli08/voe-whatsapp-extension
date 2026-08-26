// StageSelector.tsx
import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { Spinner } from './Spinner'

interface Stage {
  id: string
  name: string
  order: number
}

interface Pipeline {
  id: string
  pipeline_stages: Stage[]
}

interface Props {
  opportunityId: string
  currentStageId: string
  /** Pipeline da própria oportunidade — só mostramos etapas desse pipeline,
   * nunca de outro pipeline do workspace (workspaces podem ter mais de um). */
  pipelineId: string | null
  onMoved: () => void
}

export function StageSelector({ opportunityId, currentStageId, pipelineId, onMoved }: Props) {
  const [stages, setStages] = useState<Stage[]>([])
  const [loadingStages, setLoadingStages] = useState(true)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingStages(true)
    voeApi
      .get<{ data: Pipeline[] }>('/api/v1/pipelines')
      .then(res => {
        const pipeline = res.data.find(p => p.id === pipelineId) ?? res.data[0]
        setStages([...(pipeline?.pipeline_stages ?? [])].sort((a, b) => a.order - b.order))
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar etapas'))
      .finally(() => setLoadingStages(false))
  }, [pipelineId])

  async function handleChange(stageId: string) {
    if (stageId === currentStageId) return
    setMoving(true)
    setError(null)
    try {
      await voeApi.put(`/api/v1/opportunities/${opportunityId}/stage`, { stage_id: stageId })
      onMoved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao mover etapa')
    } finally {
      setMoving(false)
    }
  }

  if (loadingStages) return <Spinner label="Carregando etapas…" />

  return (
    <div className="stage-selector">
      <label>
        Etapa do funil
        <select
          value={currentStageId}
          disabled={moving || stages.length === 0}
          onChange={e => handleChange(e.target.value)}
        >
          {stages.map(stage => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </label>
      {moving && <Spinner label="Movendo…" />}
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
