// useCampaignOptions.ts
// Opções de "Campanha" configuradas no workspace — GET /api/v1/campaign-options.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface CampaignOption {
  id: string
  label: string
}

export function useCampaignOptions() {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    voeApi
      .get<{ data: CampaignOption[] }>('/api/v1/campaign-options')
      .then(res => { if (mounted) setCampaigns(res.data) })
      .catch(() => { if (mounted) setCampaigns([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { campaigns, loading }
}
