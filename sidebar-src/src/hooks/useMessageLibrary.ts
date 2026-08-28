// useMessageLibrary.ts
// Modelos de mensagens salvos do workspace (message_library no
// app.voeops.com — mesmo dado usado na aba de Chat da tela real de
// Oportunidades, via GET /api/v1/message-library, endpoint novo criado
// especificamente pra isso). Leitura + `refetch` (pra recarregar a lista
// depois de criar um modelo novo, ver CreateTemplateScreen.tsx) — a
// criação em si usa POST /api/v1/message-library direto via voeApi, não
// passa por este hook.

import { useCallback, useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

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
}

export function useMessageLibrary() {
  const [messages, setMessages] = useState<MessageLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await voeApi.get<{ data: MessageLibraryItem[] }>('/api/v1/message-library')
      setMessages(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar modelos de mensagens')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  return { messages, loading, error, refetch: fetchMessages }
}
