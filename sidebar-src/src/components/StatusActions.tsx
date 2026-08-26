// StatusActions.tsx
// Ganho / Perdido / Pausado / Reativar — via PUT /api/v1/opportunities/:id/status,
// que já existe e já cuida de closed_at, lost_reason e notificação por e-mail.
// Espelha as ações reais da tela de Oportunidades
// (app.voeops.com/src/app/(dashboard)/deals/[id]/page.tsx:
// handleWonLostConfirm, handleMarkPaused, handleMarkActive).

import { useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { useLossReasons } from '../hooks/useLossReasons'
import { Spinner } from './Spinner'

interface Props {
  opportunityId: string
  workspaceId: string
  currentStatus: string
  onChanged: () => void
}

export function StatusActions({ opportunityId, workspaceId, currentStatus, onChanged }: Props) {
  const { reasons, loading: loadingReasons } = useLossReasons(workspaceId)
  const [pickingLossReason, setPickingLossReason] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(status: string, lostReason?: string) {
    setSaving(true)
    setError(null)
    try {
      await voeApi.put(`/api/v1/opportunities/${opportunityId}/status`, {
        status,
        lost_reason: lostReason,
      })
      setPickingLossReason(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setSaving(false)
    }
  }

  if (pickingLossReason) {
    return (
      <div className="status-actions">
        <p className="muted">Motivo da perda:</p>
        {loadingReasons ? (
          <Spinner label="Carregando motivos…" />
        ) : reasons.length === 0 ? (
          <button disabled={saving} onClick={() => updateStatus('lost')}>
            Confirmar perda (sem motivo cadastrado)
          </button>
        ) : (
          <div className="status-actions-buttons">
            {reasons.map(reason => (
              <button
                key={reason.id}
                className="secondary"
                disabled={saving}
                onClick={() => updateStatus('lost', reason.label)}
              >
                {reason.label}
              </button>
            ))}
          </div>
        )}
        <button className="secondary" disabled={saving} onClick={() => setPickingLossReason(false)}>
          Cancelar
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  return (
    <div className="status-actions">
      <div className="status-actions-buttons">
        {currentStatus !== 'won' && (
          <button disabled={saving} onClick={() => updateStatus('won')}>
            {saving ? 'Salvando…' : 'Marcar como Vendido'}
          </button>
        )}
        {currentStatus !== 'lost' && (
          <button className="danger" disabled={saving} onClick={() => setPickingLossReason(true)}>
            Marcar como Perdido
          </button>
        )}
        {currentStatus === 'active' && (
          <button className="secondary" disabled={saving} onClick={() => updateStatus('paused')}>
            Pausar
          </button>
        )}
        {currentStatus === 'paused' && (
          <button className="secondary" disabled={saving} onClick={() => updateStatus('active')}>
            Reativar
          </button>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
