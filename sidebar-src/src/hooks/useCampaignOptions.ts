import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

export interface CampaignOption {
  id: string
  label: string
}

export function useCampaignOptions() {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    cachedFetch('campaign-options', () => voeApi.get<{ data: CampaignOption[] }>('/api/v1/campaign-options').then(r => r.data))
      .then(data => { if (mounted) setCampaigns(data) })
      .catch(() => { if (mounted) setCampaigns([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return { campaigns, loading }
}
