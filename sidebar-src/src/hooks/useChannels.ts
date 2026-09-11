import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

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
    cachedFetch('channels', () => voeApi.get<{ data: WhatsAppChannel[] }>('/api/v1/channels').then(r => r.data), 2 * 60 * 1000)
      .then(data => { if (mounted) setChannels(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Erro ao buscar canais') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { channels, loading, error }
}
