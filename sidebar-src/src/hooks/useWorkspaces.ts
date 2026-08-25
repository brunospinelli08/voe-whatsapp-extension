// useWorkspaces.ts
// Lista os workspaces que o usuário logado pertence — mesma query que a
// tela /workspaces do dashboard principal (app.voeops.com) já usa: lê
// direto do Supabase (workspace_members + join workspaces), protegido por
// RLS com a sessão do próprio usuário. Não precisa de nenhum endpoint
// novo — é a mesma lib do Supabase que já está na sidebar pro login.

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export interface WorkspaceOption {
  id: string
  name: string
  role: string
}

interface UseWorkspacesResult {
  workspaces: WorkspaceOption[]
  loading: boolean
  error: string | null
}

export function useWorkspaces(user: User | null): UseWorkspacesResult {
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setWorkspaces([])
      setLoading(false)
      return
    }

    let mounted = true

    async function fetchWorkspaces() {
      setLoading(true)
      setError(null)
      try {
        const { data: userProfile } = await supabase
          .from('users')
          .select('is_super_admin')
          .eq('id', user!.id)
          .single()

        const isSuperAdmin = userProfile?.is_super_admin === true

        if (isSuperAdmin) {
          // Super admins têm "acesso fantasma" a todos os workspaces —
          // mesma regra da tela /workspaces do dashboard.
          const { data, error: fetchError } = await supabase
            .from('workspaces')
            .select('id, name')
            .order('name')

          if (fetchError) throw fetchError
          if (!mounted) return
          setWorkspaces((data ?? []).map(ws => ({ id: ws.id, name: ws.name, role: 'admin' })))
        } else {
          const { data, error: fetchError } = await supabase
            .from('workspace_members')
            .select('workspace_id, role, workspace:workspaces!workspace_members_workspace_id_fkey(id, name)')
            .eq('user_id', user!.id)
            .order('joined_at', { ascending: false })

          if (fetchError) throw fetchError
          if (!mounted) return

          const items = (data ?? [])
            .map(item => {
              const ws = Array.isArray(item.workspace) ? item.workspace[0] : item.workspace
              return ws ? { id: ws.id, name: ws.name, role: item.role } : null
            })
            .filter((item): item is WorkspaceOption => item !== null)

          setWorkspaces(items)
        }
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar workspaces')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchWorkspaces()
    return () => {
      mounted = false
    }
  }, [user])

  return { workspaces, loading, error }
}
