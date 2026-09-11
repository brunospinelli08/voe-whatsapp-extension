// useActiveChat.ts
// Recebe o evento WHATSAPP_EVENT e, ao montar, pede o chat ativo atual
// (handshake) em vez de esperar a próxima troca de conversa.

import { useEffect, useState } from 'react'

export interface ActiveChat {
  phone: string
  name: string | null
}

function isAllowedOrigin(origin: string): boolean {
  return (
    origin === 'https://web.whatsapp.com' ||
    origin.startsWith('chrome-extension://') ||
    origin === 'https://localhost:5173'
  )
}

export function useActiveChat(): ActiveChat | null {
  const [chat, setChat] = useState<ActiveChat | null>(null)

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isAllowedOrigin(event.origin)) return
      if (event.data?.type !== 'WHATSAPP_EVENT') return
      setChat(event.data.payload ?? null)
    }

    window.addEventListener('message', handleMessage)

    // Handshake: pede o chat ativo atual ao content.js, que repassa
    // pro wa-js-bridge. Assim a sidebar já mostra o contato se abrir
    // com um chat ativo, sem esperar a próxima troca.
    window.parent.postMessage({ type: 'VOE_REQUEST_ACTIVE_CHAT' }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return chat
}
