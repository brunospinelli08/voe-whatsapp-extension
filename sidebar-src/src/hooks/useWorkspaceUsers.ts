// useWorkspaceUsers.ts
// Usuários do workspace pro seletor de "Responsável" — GET /api/v1/workspace-users.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface WorkspaceUser {
  id: string
  full_name: string
}

export function useWorkspaceUsers() {
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    voeApi
      .get<{ data: WorkspaceUser[] }>('/api/v1/workspace-users')
      .then(res => { if (mounted) setUsers(res.data) })
      .catch(() => { if (mounted) setUsers([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { users, loading }
}
