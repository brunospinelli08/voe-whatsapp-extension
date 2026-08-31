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
//
// Trocar de funil (pedido explícito do Bruno) — no dashboard real
// (deals/[id]/page.tsx) isso é um chip "Funil" ao lado do status que abre
// um menu em 2 passos: escolher o funil de destino → escolher a etapa de
// entrada nele. Aqui vira um terceiro <select>, no MESMO estilo visual da
// dupla Status|Etapa (.status-stage-select-wrap/.status-stage-select) —
// 2ª rodada: a 1ª usava chips (.pipeline-chips, o mesmo padrão de Nova
// Oportunidade), mas o Bruno pediu pra ficar parecido com o select de
// Etapa em vez disso. Só aparece com mais de um funil no workspace, numa
// linha própria acima da dupla Status|Etapa (linha inteira pra caber o
// nome do funil sem cortar). Escolher outro funil só troca as opções do
// <select> de Etapa; a mudança de verdade só é salva quando uma etapa é
// escolhida — igual ao "passo 2" do real (PUT /api/v1/opportunities/:id/
// stage já existente, sem endpoint novo: pipeline é derivado do stage_id
// no backend).

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
  // Funil "em visualização" no seletor — só diverge do funil real
  // (`pipelineId`) enquanto o usuário está escolhendo outro funil pra
  // mover a oportunidade pra ele.
  const [viewedPipelineId, setViewedPipelineId] = useState(pipelineId)
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingStage, setSavingStage] = useState(false)
  const [pickingLossReason, setPickingLossReason] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { reasons: lossReasons } = useLossReasons(workspaceId)

  useEffect(() => {
    voeApi
      .get<{ data: Pipeline[] }>('/api/v1/pipelines')
      .then(res => setPipelines(res.data))
      .catch(() => setPipelines([]))
  }, [])

  // Ressincroniza sempre que o funil real da oportunidade mudar (troca de
  // etapa salva com sucesso, ou refetch externo) — sem isso, depois de
  // mover pra outro funil o seletor continuaria "preso" mostrando o funil
  // antigo escolhido manualmente.
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
            {/* Só aparece ao trocar de funil: o valor atual não existe nas
                etapas do funil escolhido, então força uma escolha explícita
                em vez de cair silenciosamente na primeira etapa da lista. */}
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
