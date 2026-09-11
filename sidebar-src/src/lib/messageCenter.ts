import type { ApiScope } from './apiClient'
import type { LeadContact } from '../hooks/useLeadLookup'
import type { ActiveChat } from '../hooks/useActiveChat'
import type { MessageLibraryItem } from '../hooks/useMessageLibrary'

export interface MessageCenterContext {
  scope: ApiScope
  chat: ActiveChat | null
  contact: LeadContact | null
}

export type CenterType = 'all' | 'text' | 'audio' | 'image' | 'video' | 'document' | 'carousel'
export const CENTER_TYPES: { type: CenterType; label: string }[] = [
  { type: 'all', label: 'Todos' }, { type: 'text', label: 'Texto' },
  { type: 'audio', label: 'Áudio' }, { type: 'image', label: 'Imagem' },
  { type: 'video', label: 'Vídeo' }, { type: 'document', label: 'Documento' },
  { type: 'carousel', label: 'Carrossel' },
]

const CATEGORY_LABELS: Record<string, string> = {
  abertura: 'Abertura', qualificacao: 'Qualificação', apresentacao: 'Apresentação',
  engajamento: 'Engajamento', 'follow-up': 'Follow-up', recuperacao: 'Recuperação',
  visita: 'Visita', proposta: 'Proposta', fechamento: 'Fechamento', 'pos-venda': 'Pós-venda', geral: 'Geral',
}
export interface MessageLabel { slug: string; name: string; kind: 'category' | 'tag'; sort_order: number }
export const DEFAULT_MESSAGE_CATEGORIES: MessageLabel[] = Object.entries(CATEGORY_LABELS).map(([slug, name], sort_order) => ({ slug, name, sort_order, kind: 'category' }))
export const categoryLabel = (value: string | null, labels: MessageLabel[] = []) => labels.find(label => label.kind === 'category' && label.slug === (value || 'geral'))?.name ?? CATEGORY_LABELS[value || 'geral'] ?? value ?? 'Geral'
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function messageSearchText(item: MessageLibraryItem, labels: MessageLabel[] = []) {
  const tags = (item.tags ?? []).map(slug => labels.find(label => label.kind === 'tag' && label.slug === slug)?.name ?? slug)
  return normalizeSearch([item.title, item.content, item.file_name, categoryLabel(item.category, labels), ...tags].join(' '))
}

export function resolveMessage(text: string, context: MessageCenterContext) {
  const contact = context.contact
  const name = contact?.name || context.chat?.name || ''
  const values: Record<string, string> = {
    nome: name, primeiro_nome: name.trim().split(/\s+/)[0],
    telefone: context.chat?.phone || '', email: contact?.email || '',
    empresa: contact?.company?.name || '', tipo_contato: contact?.contact_type || '',
  }
  const missing = new Set<string>()
  const content = text.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) => {
    const value = values[key.toLowerCase()]
    if (value) return value
    missing.add(placeholder)
    return placeholder
  })
  return { content, missing: [...missing] }
}
