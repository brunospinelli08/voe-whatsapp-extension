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

import { useState } from 'react'
import { useMessageLibrary } from '../hooks/useMessageLibrary'
import { Spinner } from './Spinner'

export function MessageLibraryPanel() {
  const { messages, loading, error } = useMessageLibrary()
  const [copiedId, setCopiedId] = useState<string | null>(null)

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
          <p className="message-library-content">{msg.content}</p>
          <button className="secondary" onClick={() => handleCopy(msg.id, msg.content)}>
            {copiedId === msg.id ? 'Copiado!' : 'Copiar'}
          </button>
        </li>
      ))}
    </ul>
  )
}
