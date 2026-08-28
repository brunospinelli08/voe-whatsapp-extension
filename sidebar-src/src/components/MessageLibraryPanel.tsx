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
// (agendar precisa de contact_id).

import { useState } from 'react'
import { useMessageLibrary, type MessageLibraryItem } from '../hooks/useMessageLibrary'
import { ScheduleMessagePanel, MEDIA_TYPE_LABEL } from './ScheduleMessagePanel'
import { Spinner } from './Spinner'
import { ChevronLeftIcon, ClockIcon } from './Icons'

const SCHEDULABLE_TYPES = new Set(['text', 'audio', 'image', 'video', 'document'])

interface Props {
  /** Contato do chat ativo — sem ele, "Agendar" fica oculto (mesma regra do ScheduleMessagePanel). */
  contactId: string | null
  /** Repassada pro ScheduleMessagePanel — sem isso a mensagem agendada não aparece na aba Atividades. */
  opportunityId?: string | null
}

export function MessageLibraryPanel({ contactId, opportunityId }: Props) {
  const { messages, loading, error } = useMessageLibrary()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<MessageLibraryItem | null>(null)

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

  if (loading) return <Spinner label="Carregando modelos de mensagens…" />

  if (error) {
    return (
      <div className="error-banner">
        <span>⚠</span>
        <span>{error}</span>
      </div>
    )
  }

  if (messages.length === 0) {
    return <p className="muted">Nenhum modelo de mensagem cadastrado nesse workspace ainda.</p>
  }

  return (
    <ul className="message-library-list">
      {messages.map(msg => (
        <li key={msg.id} className="message-library-item">
          <div className="message-library-item-header">
            <strong>{msg.title}</strong>
            {msg.is_favorite && <span title="Favorito">★</span>}
          </div>
          {msg.content_type !== 'text' && (
            <p className="message-library-content">
              <span className="schedule-media-badge">{MEDIA_TYPE_LABEL[msg.content_type] ?? msg.content_type}</span>
              {msg.file_name ? ` ${msg.file_name}` : ''}
            </p>
          )}
          {msg.content && (msg.content_type === 'text' || msg.content_type === 'audio') && (
            <p className="message-library-content">{msg.content}</p>
          )}
          <div className="message-library-item-actions">
            <button className="secondary" onClick={() => handleCopy(msg.id, msg.content)}>
              {copiedId === msg.id ? 'Copiado!' : 'Copiar'}
            </button>
            {SCHEDULABLE_TYPES.has(msg.content_type) && (msg.content_type === 'text' || msg.file_url) && contactId && (
              <button className="secondary" onClick={() => setScheduleTarget(msg)}>
                <ClockIcon size={11} /> Agendar
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
