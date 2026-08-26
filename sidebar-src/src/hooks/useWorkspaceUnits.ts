// useWorkspaceUnits.ts
// Unidades ativas do workspace (multi-venue) — GET /api/v1/workspace-units.
// O campo "Unidade do evento" só deve aparecer quando há mais de uma (mesma
// regra do formulário real).

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface WorkspaceUnit {
  id: string
  name: string
}

export function useWorkspaceUnits() {
  const [units, setUnits] = useState<WorkspaceUnit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    voeApi
      .get<{ data: WorkspaceUnit[] }>('/api/v1/workspace-units')
      .then(res => { if (mounted) setUnits(res.data) })
      .catch(() => { if (mounted) setUnits([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { units, loading }
}
