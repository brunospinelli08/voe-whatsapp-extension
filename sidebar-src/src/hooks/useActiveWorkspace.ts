// useActiveWorkspace.ts
// Workspace ativo da extensão: lido de chrome.storage.local ao logar (não
// pede de novo toda vez), com uma função pra trocar — que atualiza o
// workspace ativo no servidor (users.workspace_id, via
// POST /api/workspaces/select) e garante um token pra ele antes de
// persistir a escolha localmente.
//
// Recebe `userId` (da sessão do Supabase) e reage a mudanças nele: sem
// isso, deslogar limpava o storage mas o estado em memória continuava
// com o workspace antigo — ao logar de novo (mesma sidebar, sem reload),
// a tela de seleção era pulada por engano e as chamadas à API quebravam
// com "Nenhum workspace selecionado" (o storage, lido de novo ali dentro,
// já estava vazio).

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

export function useActiveWorkspace(userId: string | null): UseActiveWorkspaceResult {
  const [activeWorkspace, setActiveWorkspaceState] = useState<ActiveWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      // Sem sessão — nada pra carregar, e garante que não sobra workspace
      // de uma sessão anterior (de outra conta, ou de antes do logout).
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
        await getVoeToken(accessToken, userId, id) // garante que já existe um token pronto pra esse workspace

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
    setActiveWorkspaceState(null)
  }, [userId])

  return { activeWorkspace, loading, error, selectWorkspace, changeWorkspace }
}
