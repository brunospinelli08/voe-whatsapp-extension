// useNotes.ts
// Anotações já existentes de uma oportunidade — GET /api/v1/opportunities/[id]/notes
// (endpoint que já existia só pra criar; a extensão nunca tinha usado o GET
// até agora, então nunca mostrava as anotações que já existiam).

import { useCallback, useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'

export interface Note {
  id: string
  content: string
  created_at: string
  users?: { full_name: string } | null
}

export function useNotes(opportunityId: string) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotes = useCallback(() => {
    setLoading(true)
    voeApi
      .get<{ data: Note[] }>(`/api/v1/opportunities/${opportunityId}/notes`)
      .then(res => setNotes(res.data))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false))
  }, [opportunityId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  return { notes, loading, refetch: fetchNotes }
}
