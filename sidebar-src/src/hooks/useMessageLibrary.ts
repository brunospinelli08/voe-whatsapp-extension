// useMessageLibrary.ts
// Modelos de mensagens salvos do workspace (message_library no
// app.voeops.com — mesmo dado usado na aba de Chat da tela real de
// Oportunidades, via GET /api/v1/message-library, endpoint novo criado
// especificamente pra isso). Leitura + `refetch` (pra recarregar a lista
// depois de criar um modelo novo, ver CreateTemplateScreen.tsx) — a
// criação em si usa POST /api/v1/message-library direto via voeApi, não
// passa por este hook.

import { useCallback, useEffect, useState } from 'react'
import { voeApi, type ApiScope } from '../lib/apiClient'
import { supabase } from '../lib/supabaseClient'
import { getActiveWorkspace } from '../lib/workspaceStorage'

export interface CarouselCard {
  header_type: 'image' | 'video'
  header_url: string
  body_text?: string
  cta_url_text?: string
  cta_url_value?: string
}

export interface MessageLibraryItem {
  id: string
  title: string
  content: string
  content_type: string
  /** URL assinada/pública do Storage — só presente em itens de mídia (áudio/imagem/vídeo/documento). */
  file_url: string | null
  file_name: string | null
  category: string | null
  funnel_stage: string | null
  is_favorite: boolean
  tags?: string[] | null
  use_count?: number
  /** Só presente em itens do tipo carousel — cartões do carrossel (ver CarouselCard). */
  carousel_cards: CarouselCard[] | null
}

const TTL = 60_000
interface Entry { messages: MessageLibraryItem[]; fetchedAt: number }
const cache = new Map<string, Entry>()
const pending = new Map<string, Promise<Entry>>()
const keyFor = (scope: ApiScope) => `voe-message-library:${scope.userId}:${scope.workspaceId}`

async function loadLibrary(scope: ApiScope, force: boolean, onCached: (entry: Entry) => void): Promise<Entry> {
  const key = keyFor(scope)
  const existing = pending.get(key)
  if (existing) return existing
  const request = (async () => {
    let entry = cache.get(key)
    if (!entry) {
      // Cache apenas da sessão do navegador; não persiste o conteúdo no disco.
      const stored = await chrome.storage.session.get(key).catch(() => ({} as Record<string, Entry>))
      entry = stored[key]
      if (entry) cache.set(key, entry)
    }
    if (entry) onCached(entry)
    if (!force && entry && Date.now() - entry.fetchedAt < TTL) return entry
    const result = await voeApi.getScoped<{ data: MessageLibraryItem[] }>('/api/v1/message-library', scope)
    const next = { messages: result.data, fetchedAt: Date.now() }
    cache.set(key, next)
    await chrome.storage.session.set({ [key]: next }).catch(() => {})
    return next
  })().finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}

export function useMessageLibrary(providedScope?: ApiScope) {
  const [resolvedScope, setResolvedScope] = useState<ApiScope | null>(null)
  const scope = providedScope ?? resolvedScope
  const userId = scope?.userId
  const workspaceId = scope?.workspaceId
  const key = scope ? keyFor(scope) : ''
  const [state, setState] = useState<{ key: string; entry?: Entry; error: string | null; loading: boolean }>({
    key, entry: cache.get(key), loading: !cache.has(key), error: null,
  })
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (providedScope) return
    let active = true
    void supabase.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id
      const workspace = id ? await getActiveWorkspace(id) : null
      if (active && id && workspace) setResolvedScope({ userId: id, workspaceId: workspace.id })
    })
    return () => { active = false }
  }, [providedScope])

  useEffect(() => {
    if (!userId || !workspaceId) return
    let active = true
    const currentScope = { userId, workspaceId }
    const currentKey = keyFor(currentScope)
    const fetchMessages = (force = false) => {
      setState(prev => ({ key: currentKey, entry: cache.get(currentKey), loading: true, error: force ? null : prev.error }))
      void loadLibrary(currentScope, force, entry => {
        if (active) setState({ key: currentKey, entry, loading: true, error: null })
      }).then(entry => {
        if (active) setState({ key: currentKey, entry, loading: false, error: null })
      }).catch(err => {
        if (active) setState({ key: currentKey, entry: cache.get(currentKey), loading: false,
          error: err instanceof Error ? err.message : 'Erro ao buscar mensagens' })
      })
    }
    function onStorage(changes: Record<string, chrome.storage.StorageChange>, area: string) {
      const entry = changes[currentKey]?.newValue as Entry | undefined
      if (area !== 'session' || !entry) return
      cache.set(currentKey, entry)
      if (active) setState({ key: currentKey, entry, loading: false, error: null })
    }
    const onFocus = () => fetchMessages()
    chrome.storage.onChanged.addListener(onStorage)
    window.addEventListener('focus', onFocus)
    window.addEventListener('voe-center-open', onFocus)
    fetchMessages(refresh > 0)
    return () => {
      active = false
      chrome.storage.onChanged.removeListener(onStorage)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('voe-center-open', onFocus)
    }
  }, [userId, workspaceId, refresh])

  const refetch = useCallback(() => setRefresh(n => n + 1), [])
  const entry = state.key === key ? state.entry : cache.get(key)
  return { messages: entry?.messages ?? [], loading: !entry && state.loading,
    refreshing: !!entry && state.loading, error: state.key === key ? state.error : null, refetch }
}
