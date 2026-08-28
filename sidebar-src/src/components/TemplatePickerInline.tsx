// TemplatePickerInline.tsx
// Seletor de "Modelos de mensagens", usado DENTRO do fluxo de agendamento
// (ScheduleMessagePanel.tsx, dentro de Nova Atividade → WhatsApp — não
// existe mais um menu de "Modelos de mensagens" avulso no cabeçalho do
// lead; consolidado tudo aqui a pedido explícito). Um clique no item já
// seleciona — sem "Copiar"/"Agendar" separados, só existe UMA ação
// possível aqui dentro: usar pra agendar.
//
// "+ Novo" abre CreateTemplateScreen.tsx (antes só alcançável pelo
// MessageLibraryPanel.tsx removido) — criar um modelo sem sair do fluxo.
//
// SCHEDULABLE_TYPES/TYPE_ICONS exportados daqui — única fonte, nada mais
// os reimporta agora que MessageLibraryPanel.tsx foi removido.

import { useMemo, useState } from 'react'
import { useMessageLibrary, type MessageLibraryItem } from '../hooks/useMessageLibrary'
import { CreateTemplateScreen } from './CreateTemplateScreen'
import { Spinner } from './Spinner'
import {
  ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon, XIcon,
  MessageCircleIcon, MicIcon, ImageIcon, VideoIcon, FileTextIcon,
} from './Icons'

export const SCHEDULABLE_TYPES = new Set(['text', 'audio', 'image', 'video', 'document'])

export const TYPE_ICONS: Record<string, typeof MessageCircleIcon> = {
  text: MessageCircleIcon,
  audio: MicIcon,
  image: ImageIcon,
  video: VideoIcon,
  document: FileTextIcon,
}

interface Props {
  onSelect: (item: MessageLibraryItem) => void
  onClose: () => void
}

export function TemplatePickerInline({ onSelect, onClose }: Props) {
  const { messages, loading, error, refetch } = useMessageLibrary()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    const schedulable = messages.filter(
      m => SCHEDULABLE_TYPES.has(m.content_type) && (m.content_type === 'text' || m.file_url),
    )
    if (!search.trim()) return schedulable
    const q = search.trim().toLowerCase()
    return schedulable.filter(m => m.title.toLowerCase().includes(q) || (m.content ?? '').toLowerCase().includes(q))
  }, [messages, search])

  if (showCreate) {
    return (
      <CreateTemplateScreen
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); refetch() }}
      />
    )
  }

  return (
    <div className="template-picker">
      <div className="template-picker-header">
        <button type="button" className="back-button-danger" onClick={onClose}>
          <ChevronLeftIcon size={13} /> Voltar
        </button>
        <span>Escolher modelo</span>
        <button type="button" className="message-library-create-btn" onClick={() => setShowCreate(true)} title="Novo modelo">
          <PlusIcon size={10} /> Novo
        </button>
      </div>

      <div className="message-library-search">
        <SearchIcon size={11} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar modelos…"
          autoFocus
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca">
            <XIcon size={10} />
          </button>
        )}
      </div>

      {loading && <Spinner label="Carregando modelos…" />}

      {error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="muted">
          {messages.length === 0 ? 'Nenhum modelo de mensagem cadastrado nesse workspace ainda.' : 'Nenhum resultado para essa busca.'}
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <ul className="template-picker-list">
          {filtered.map(item => {
            const Icon = TYPE_ICONS[item.content_type]
            const preview = item.content_type === 'text' ? item.content : item.file_name
            return (
              <li key={item.id}>
                <button type="button" className="template-picker-item" onClick={() => onSelect(item)}>
                  <span className="template-picker-icon">{Icon && <Icon size={13} />}</span>
                  <span className="template-picker-text">
                    <span className="template-picker-title">
                      {item.is_favorite && <span className="message-library-fav">★</span>} {item.title}
                    </span>
                    {preview && <span className="template-picker-preview">{preview}</span>}
                  </span>
                  <ChevronRightIcon size={13} className="template-picker-chevron" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
