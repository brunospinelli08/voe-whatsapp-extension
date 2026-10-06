// useWaTemplates.ts
// Templates aprovados do WhatsApp API Oficial (wa_templates) — GET
// /api/v1/wa-templates. Mesmo dado que o ActivityModal do dashboard carrega
// pra agendar WhatsApp num canal cloud_api. Helpers de tag/arquivado
// espelham lib/templateUtils.ts de lá.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { cachedFetch } from '../lib/configCache'

export interface WaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | string
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | string
  text?: string
  example?: { header_url?: string[] }
  buttons?: { type: string; text: string }[]
}

export interface WaTemplate {
  id: string
  connection_id: string
  name: string
  category: 'MARKETING' | 'UTILITY' | string
  language: string
  components: WaTemplateComponent[]
  tags: string[] | null
}

export function useWaTemplates(enabled: boolean) {
  const [templates, setTemplates] = useState<WaTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let mounted = true
    setLoading(true)
    setError(null)
    cachedFetch('wa-templates', () => voeApi.get<{ data: WaTemplate[] }>('/api/v1/wa-templates').then(r => r.data), 2 * 60 * 1000)
      .then(data => { if (mounted) setTemplates(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Erro ao buscar templates') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [enabled])

  return { templates, loading, error }
}

/** Tag reservada para arquivar templates — oculta por padrão. */
export const ARCHIVED_TAG = 'Arquivado'

export const isArchived = (t: Pick<WaTemplate, 'tags'>) => (t.tags ?? []).includes(ARCHIVED_TAG)

const TAG_TONES = ['blue', 'purple', 'green', 'amber', 'rose', 'teal', 'orange', 'indigo']

/** Mesma cor por hash do nome (tagColor do dashboard), como classe tone-*. */
export function tagTone(tag: string) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_TONES[Math.abs(hash) % TAG_TONES.length]
}

export function collectTags(templates: WaTemplate[]) {
  const set = new Set<string>()
  templates.forEach(t => (t.tags ?? []).filter(tag => tag !== ARCHIVED_TAG).forEach(tag => set.add(tag)))
  return Array.from(set).sort()
}

/** Maior índice {{n}} no BODY — quantas variáveis o template pede. */
export function countTemplateVars(components: WaTemplateComponent[]) {
  const body = components.find(c => c.type === 'BODY')
  if (!body?.text) return 0
  const matches = Array.from(body.text.matchAll(/\{\{(\d+)\}\}/g))
  return matches.length ? Math.max(...matches.map(m => parseInt(m[1]))) : 0
}

/** "boas_vindas_lead" → "Boas Vindas Lead" (título automático, igual ao dashboard). */
export function readableTemplateName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
