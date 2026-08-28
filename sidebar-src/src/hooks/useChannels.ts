// useChannels.ts
// Canais de WhatsApp do workspace (whatsapp_channels, via GET
// /api/v1/channels — endpoint novo, criado especificamente pra permitir
// agendar mensagens na extensão: o dashboard sabe o channel_id de graça
// porque já está dentro de uma conversa aberta; a extensão não tinha
// nenhuma noção de canal até agora). Só leitura.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface WhatsAppChannel {
  id: string
  display_name: string
  provider: string
  connection_status: string
  phone_number: string | null
  is_default: boolean
}

export function useChannels() {
  const [channels, setChannels] = useState<WhatsAppChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    voeApi
      .get<{ data: WhatsAppChannel[] }>('/api/v1/channels')
      .then(res => {
        if (mounted) setChannels(res.data)
      })
      .catch(err => {
        if (mounted) setError(err instanceof Error ? err.message : 'Erro ao buscar canais')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return { channels, loading, error }
}
