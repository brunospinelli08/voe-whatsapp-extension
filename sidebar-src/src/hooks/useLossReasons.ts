// useLossReasons.ts
// Motivos de perda configurados no workspace — mesma tabela que a tela de
// Oportunidades do app.voeops.com usa (src/app/(dashboard)/deals/[id]/page.tsx),
// lida direto do Supabase (RLS protege por workspace_id), sem endpoint novo.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface LossReason {
  id: string
  label: string
}

export function useLossReasons(workspaceId: string | null) {
  const [reasons, setReasons] = useState<LossReason[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) {
      setReasons([])
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)

    supabase
      .from('loss_reasons')
      .select('id, label')
      .eq('workspace_id', workspaceId)
      .order('created_at')
      .then(({ data }) => {
        if (!mounted) return
        setReasons(data ?? [])
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [workspaceId])

  return { reasons, loading }
}
