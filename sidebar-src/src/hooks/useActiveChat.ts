// useActiveChat.ts
// Recebe o evento WHATSAPP_EVENT repassado pelo content.js (postMessage),
// originado do CustomEvent VOE_WHATSAPP_EVENT disparado por wa-js-bridge.js
// no contexto real da página do WhatsApp Web.

import { useEffect, useState } from 'react'

export interface ActiveChat {
  phone: string
  name: string | null
}

export function useActiveChat(): ActiveChat | null {
  const [chat, setChat] = useState<ActiveChat | null>(null)

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // TODO(segurança): quando o domínio de origem do content script for
      // sempre o mesmo (web.whatsapp.com), validar event.origin aqui.
      if (event.data?.type !== 'WHATSAPP_EVENT') return
      setChat(event.data.payload ?? null)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return chat
}
