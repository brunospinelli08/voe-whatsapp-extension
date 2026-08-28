// MessageLibraryPanel.tsx
// Lista dos "Modelos de mensagens" do workspace (nomenclatura real do
// dashboard — ver src/components/settings/MessageModelsManager.tsx em
// app.voeops.com), com um botão pra copiar o texto.
//
// Por que copiar em vez de enviar direto no WhatsApp: enviar exigiria uma
// ponte nova de mão dupla (sidebar → content script → contexto da página →
// wa-js) que ainda não existe e não dá pra validar sem testar contra uma
// sessão real do WhatsApp Web — fica de fora desta rodada por segurança.
// Copiar já cobre o caso de uso (colar na caixa de mensagem manualmente)
// sem esse risco.
//
// "Agendar" (ver ScheduleMessagePanel.tsx) é uma segunda ação por item:
// abre o mesmo formulário de agendamento no lugar da lista, com um
// "Voltar" pra retornar. Funciona pra texto e pra mídia (áudio/imagem/
// vídeo/documento, com `file_url`) — só o carrossel interativo fica de
// fora, sem equivalente de envio simples. Exige um contato já resolvido
// (agendar precisa de contact_id). Esse é o caminho "biblioteca → agendar";
// o caminho inverso ("já estou agendando, quero escolher um modelo agora")
// é o TemplatePickerInline.tsx, de dentro do ScheduleMessagePanel — mesma
// SCHEDULABLE_TYPES/TYPE_ICONS, importados de lá (fonte única).
//
// "+" no cabeçalho abre CreateTemplateScreen.tsx — criar um modelo novo,
// sem sair da extensão.
//
// Visual: réplica de MessageCenterPanel.tsx (header com contagem, busca,
// cards compactos com ações reveladas só no hover) — pedido explícito do
// Bruno depois de achar a versão anterior poluída (ações sempre visíveis,
// badge colorido de emoji). Sem os filtros de categoria/coleções do real:
// dependem de dados de taxonomia do workspace que a extensão ainda não
// busca (message_library_labels/message_collections) — fora do escopo de
// um ajuste visual.

import { useMemo, useState } from 'react'
import { useMessageLibrary, type MessageLibraryItem } from '../hooks/useMessageLibrary'
import { ScheduleMessagePanel } from './ScheduleMessagePanel'
import { CreateTemplateScreen } from './CreateTemplateScreen'
import { SCHEDULABLE_TYPES, TYPE_ICONS } from './TemplatePickerInline'
import { Spinner } from './Spinner'
import { ChevronLeftIcon, ClockIcon, PlusIcon, SearchIcon, XIcon, MessageCircleIcon } from './Icons'

interface Props {
  /** Contato do chat ativo — sem ele, "Agendar" fica oculto (mesma regra do ScheduleMessagePanel). */
  contactId: string | null
  /** Repassada pro ScheduleMessagePanel — sem isso a mensagem agendada não aparece na aba Atividades. */
  opportunityId?: string | null
}

export function MessageLibraryPanel({ contactId, opportunityId }: Props) {
  const { messages, loading, error, refetch } = useMessageLibrary()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<MessageLibraryItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return messages
    const q = search.trim().toLowerCase()
    return messages.filter(m => m.title.toLowerCase().includes(q) || (m.content ?? '').toLowerCase().includes(q))
  }, [messages, search])

  async function handleCopy(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(current => (current === id ? null : current)), 2000)
    } catch {
      // Clipboard API pode falhar por permissão do navegador — sem
      // fallback aqui, é só um "copiado" que não aparece.
    }
  }

  if (scheduleTarget && contactId) {
    return (
      <div>
        <button className="back-button" onClick={() => setScheduleTarget(null)}>
          <ChevronLeftIcon size={13} /> Voltar
        </button>
        <p className="message-library-content" style={{ margin: '8px 0 12px' }}>
          <strong>{scheduleTarget.title}</strong>
        </p>
        <ScheduleMessagePanel
          key={scheduleTarget.id}
          contactId={contactId}
          opportunityId={opportunityId}
          libraryItem={scheduleTarget}
        />
      </div>
    )
  }

  if (showCreate) {
    return (
      <CreateTemplateScreen
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); refetch() }}
      />
    )
  }

  if (loading) return <Spinner label="Carregando modelos de mensagens…" />

  if (error) {
    return (
      <div className="error-banner">
        <span>⚠</span>
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div>
      <div className="message-library-header">
        <MessageCircleIcon size={13} />
        <span>Modelos de mensagens</span>
        <span className="message-library-count">({filtered.length})</span>
        <button type="button" className="message-library-create-btn" onClick={() => setShowCreate(true)} title="Novo modelo">
          <PlusIcon size={10} /> Novo
        </button>
      </div>

      {messages.length > 0 && (
        <div className="message-library-search">
          <SearchIcon size={11} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar modelos…"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca">
              <XIcon size={10} />
            </button>
          )}
        </div>
      )}

      {messages.length === 0 ? (
        <p className="muted">Nenhum modelo de mensagem cadastrado nesse workspace ainda.</p>
      ) : filtered.length === 0 ? (
        <p className="muted">Nenhum resultado para essa busca.</p>
      ) : (
        <ul className="message-library-list">
          {filtered.map(msg => {
            const Icon = TYPE_ICONS[msg.content_type]
            const canSchedule = SCHEDULABLE_TYPES.has(msg.content_type) && (msg.content_type === 'text' || msg.file_url) && contactId
            return (
              <li key={msg.id} className="message-library-item">
                <div className="message-library-item-top">
                  <div className="message-library-item-main">
                    <div className="message-library-item-header">
                      {msg.is_favorite && <span className="message-library-fav" title="Favorito">★</span>}
                      <strong>{msg.title}</strong>
                    </div>
                    {msg.content_type === 'text' && msg.content && (
                      <p className="message-library-content">{msg.content}</p>
                    )}
                    {msg.content_type !== 'text' && (
                      <p className="message-library-file-line">
                        {Icon && <Icon size={10} />}
                        {msg.file_name || MEDIA_TYPE_FALLBACK[msg.content_type] || msg.content_type}
                      </p>
                    )}
                    {msg.content_type === 'audio' && msg.content && (
                      <p className="message-library-content">{msg.content}</p>
                    )}
                  </div>
                  <div className="message-library-item-actions">
                    <button className="link-button" onClick={() => handleCopy(msg.id, msg.content)}>
                      {copiedId === msg.id ? 'Copiado!' : 'Copiar'}
                    </button>
                    {canSchedule && (
                      <button className="message-library-schedule-btn" onClick={() => setScheduleTarget(msg)}>
                        <ClockIcon size={10} /> Agendar
                      </button>
                    )}
                  </div>
                </div>
                {msg.category && (
                  <span className="message-library-category">{msg.category}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const MEDIA_TYPE_FALLBACK: Record<string, string> = {
  audio: 'Áudio', image: 'Imagem', video: 'Vídeo', document: 'Documento',
}
