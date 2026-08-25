// useActiveWorkspace.ts
// Workspace ativo da extensão: lido de chrome.storage.local ao abrir (não
// pede de novo toda vez), com uma função pra trocar — que atualiza o
// workspace ativo no servidor (users.workspace_id, via
// POST /api/workspaces/select) e garante um token pra ele antes de
// persistir a escolha localmente.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getVoeToken, selectWorkspaceOnServer } from '../lib/voeToken'
import {
  ActiveWorkspace,
  getActiveWorkspace,
  setActiveWorkspace as persistActiveWorkspace,
  clearActiveWorkspace,
} from '../lib/workspaceStorage'

interface UseActiveWorkspaceResult {
  activeWorkspace: ActiveWorkspace | null
  loading: boolean
  error: string | null
  /** Troca o workspace ativo (persiste local + sincroniza no servidor + garante token). */
  selectWorkspace: (id: string, name: string) => Promise<void>
  /** Volta pra tela de seleção (não desloga, só esquece a escolha atual). */
  changeWorkspace: () => void
}

export function useActiveWorkspace(): UseActiveWorkspaceResult {
  const [activeWorkspace, setActiveWorkspaceState] = useState<ActiveWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getActiveWorkspace().then(stored => {
      if (!mounted) return
      setActiveWorkspaceState(stored)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  const selectWorkspace = useCallback(async (id: string, name: string) => {
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sessão expirada, faça login novamente.')

      await selectWorkspaceOnServer(accessToken, id)
      await getVoeToken(accessToken, id) // garante que já existe um token pronto pra esse workspace

      await persistActiveWorkspace({ id, name })
      setActiveWorkspaceState({ id, name })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao selecionar workspace')
      throw err
    }
  }, [])

  const changeWorkspace = useCallback(() => {
    clearActiveWorkspace()
    setActiveWorkspaceState(null)
  }, [])

  return { activeWorkspace, loading, error, selectWorkspace, changeWorkspace }
}
