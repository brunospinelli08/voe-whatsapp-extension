// useActiveWorkspace.ts
// Workspace ativo da extensão: lido de chrome.storage.local ao logar,
// com função pra trocar. Limpa caches ao mudar de workspace.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getVoeToken, selectWorkspaceOnServer } from '../lib/voeToken'
import {
  ActiveWorkspace,
  getActiveWorkspace,
  setActiveWorkspace as persistActiveWorkspace,
  clearActiveWorkspace,
} from '../lib/workspaceStorage'
import { clearAllCache } from '../lib/configCache'
import { clearLeadCache } from '../lib/leadCache'

interface UseActiveWorkspaceResult {
  activeWorkspace: ActiveWorkspace | null
  loading: boolean
  error: string | null
  selectWorkspace: (id: string, name: string) => Promise<void>
  changeWorkspace: () => void
}

export function useActiveWorkspace(userId: string | null): UseActiveWorkspaceResult {
  const [activeWorkspace, setActiveWorkspaceState] = useState<ActiveWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setActiveWorkspaceState(null)
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)
    getActiveWorkspace(userId).then(stored => {
      if (!mounted) return
      setActiveWorkspaceState(stored)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [userId])

  const selectWorkspace = useCallback(
    async (id: string, name: string) => {
      if (!userId) throw new Error('Sessão expirada, faça login novamente.')
      setError(null)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (!accessToken) throw new Error('Sessão expirada, faça login novamente.')

        await selectWorkspaceOnServer(accessToken, id)
        await getVoeToken(accessToken, userId, id)

        // Limpa caches do workspace anterior
        clearAllCache()
        clearLeadCache()

        await persistActiveWorkspace(userId, { id, name })
        setActiveWorkspaceState({ id, name })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao selecionar workspace')
        throw err
      }
    },
    [userId],
  )

  const changeWorkspace = useCallback(() => {
    if (userId) clearActiveWorkspace(userId)
    clearAllCache()
    clearLeadCache()
    setActiveWorkspaceState(null)
  }, [userId])

  return { activeWorkspace, loading, error, selectWorkspace, changeWorkspace }
}
