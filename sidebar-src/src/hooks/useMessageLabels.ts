import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { cachedFetch } from '../lib/configCache'
import type { ApiScope } from '../lib/apiClient'
import { DEFAULT_MESSAGE_CATEGORIES, type MessageLabel } from '../lib/messageCenter'

// Mesmo padrão de useLossReasons: leitura autenticada com RLS, sem criar ou
// alterar categorias. Nomes e ordem vêm da configuração usada pelo Inbox.
export function useMessageLabels({ userId, workspaceId }: ApiScope) {
  const key = `message-labels:${userId}:${workspaceId}`
  const [state, setState] = useState<{ key: string; labels: MessageLabel[]; error: string | null }>({ key, labels: [], error: null })
  useEffect(() => {
    let active = true
    const fetchLabels = () => {
      void cachedFetch(key, async () => {
        const { data: auth } = await supabase.auth.getSession()
        if (auth.session?.user.id !== userId) throw new Error('A sessão mudou. Abra a Central novamente.')
        const { data, error } = await supabase.from('message_library_labels')
          .select('slug, name, kind, sort_order').eq('workspace_id', workspaceId)
          .order('sort_order', { ascending: true }).order('name', { ascending: true })
        if (error) throw new Error('Não foi possível atualizar os temas do workspace.')
        return (data ?? []) as MessageLabel[]
      }, 60_000).then(labels => { if (active) setState({ key, labels, error: null }) })
        .catch(error => { if (active) setState(previous => ({ key, labels: previous.key === key ? previous.labels : [], error: error.message })) })
    }
    fetchLabels()
    window.addEventListener('voe-center-open', fetchLabels)
    window.addEventListener('focus', fetchLabels)
    return () => { active = false; window.removeEventListener('voe-center-open', fetchLabels); window.removeEventListener('focus', fetchLabels) }
  }, [key, userId, workspaceId])
  const labels = state.key === key ? state.labels : []
  return {
    labels,
    categories: labels.some(label => label.kind === 'category') ? labels.filter(label => label.kind === 'category') : DEFAULT_MESSAGE_CATEGORIES,
    error: state.key === key ? state.error : null,
  }
}
