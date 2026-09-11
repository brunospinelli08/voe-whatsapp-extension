import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

export interface WorkspaceUser {
  id: string
  full_name: string
}

export function useWorkspaceUsers() {
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    cachedFetch('workspace-users', () => voeApi.get<{ data: WorkspaceUser[] }>('/api/v1/workspace-users').then(r => r.data))
      .then(data => { if (mounted) setUsers(data) })
      .catch(() => { if (mounted) setUsers([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { users, loading }
}
