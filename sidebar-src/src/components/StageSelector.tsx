// StageSelector.tsx
import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

interface Stage {
  id: string
  name: string
  pipeline_id: string
}

interface Pipeline {
  id: string
  name: string
  pipeline_stages: Stage[]
}

interface Props {
  opportunityId: string
  currentStageId: string
  onMoved: () => void
}

export function StageSelector({ opportunityId, currentStageId, onMoved }: Props) {
  const [stages, setStages] = useState<Stage[]>([])
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    voeApi
      .get<{ data: Pipeline[] }>('/api/v1/pipelines')
      .then(res => setStages(res.data.flatMap(p => p.pipeline_stages)))
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar etapas'))
  }, [])

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
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
