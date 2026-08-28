// useMessageLibrary.ts
// Modelos de mensagens salvos do workspace (message_library no
// app.voeops.com — mesmo dado usado na aba de Chat da tela real de
// Oportunidades, via GET /api/v1/message-library, endpoint novo criado
// especificamente pra isso). Só leitura.

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    voeApi
      .get<{ data: MessageLibraryItem[] }>('/api/v1/message-library')
      .then(res => {
        if (mounted) setMessages(res.data)
      })
      .catch(err => {
        if (mounted) setError(err instanceof Error ? err.message : 'Erro ao buscar modelos de mensagens')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return { messages, loading, error }
}
