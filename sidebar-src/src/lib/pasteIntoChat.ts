// pasteIntoChat.ts
// "Colar na conversa" — ponte sidebar -> content.js -> DOM do WhatsApp Web.
// Não é envio automático: só preenche a caixa (como um Ctrl+V).

import { sendMessageWithTimeout } from './backgroundFetch'

const PASTE_TIMEOUT_MS = 15_000

interface FetchMediaResult {
  ok: boolean
  base64?: string
  contentType?: string
  error?: string
}

async function fetchMediaBase64(url: string): Promise<{ base64: string; contentType: string }> {
  const result = await sendMessageWithTimeout<FetchMediaResult>({
    type: 'VOE_FETCH_MEDIA_BASE64',
    url,
  })
  if (!result?.ok || !result.base64) {
    throw new Error(result?.error || 'Erro ao baixar o arquivo pra colar na conversa')
  }
  return { base64: result.base64, contentType: result.contentType || 'application/octet-stream' }
}

function waitForPasteResult(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      reject(new Error('O WhatsApp Web não respondeu a tempo. Abra uma conversa e tente de novo.'))
    }, PASTE_TIMEOUT_MS)

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'VOE_PASTE_RESULT' || event.data.id !== id) return
      clearTimeout(timeout)
      window.removeEventListener('message', handleMessage)
      if (event.data.ok) resolve()
      else reject(new Error(event.data.error || 'Não foi possível colar na conversa'))
    }

    window.addEventListener('message', handleMessage)
  })
}

function sendToContentScript(payload: Record<string, unknown>): Promise<void> {
  const id = `voe-paste-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const resultPromise = waitForPasteResult(id)
  window.parent.postMessage({ type: 'VOE_PASTE_INTO_CHAT', id, payload }, '*')
  return resultPromise
}

/** Cola texto puro na caixa de digitar do chat ativo. */
export function pasteTextIntoChat(text: string): Promise<void> {
  return sendToContentScript({ kind: 'text', text })
}

/**
 * Cola um arquivo de midia na caixa de digitar.
 * `expectedPhone` e o telefone do chat onde o usuario iniciou a acao —
 * se o chat ativo mudou durante o download, aborta pra nao colar no
 * destinatario errado.
 */
export async function pasteMediaIntoChat(
  fileUrl: string,
  fileName: string,
  expectedPhone?: string | null,
): Promise<void> {
  const { base64, contentType } = await fetchMediaBase64(fileUrl)

  // Verifica se a conversa ativa ainda e a mesma de quando o usuario clicou
  if (expectedPhone) {
    const currentChat = await getCurrentChatPhone()
    if (currentChat && currentChat !== expectedPhone) {
      throw new Error('A conversa mudou durante o download. Volte ao chat correto e tente novamente.')
    }
  }

  return sendToContentScript({ kind: 'file', base64, fileName, mimeType: contentType })
}

/** Pergunta ao content.js qual o telefone do chat ativo agora. */
function getCurrentChatPhone(): Promise<string | null> {
  return new Promise(resolve => {
    const id = `voe-chat-check-${Date.now()}`
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler)
      resolve(null) // se nao responder, nao bloqueia — segue sem verificacao
    }, 2000)

    function handler(event: MessageEvent) {
      if (event.data?.type !== 'VOE_CURRENT_CHAT_RESULT' || event.data.id !== id) return
      clearTimeout(timeout)
      window.removeEventListener('message', handler)
      resolve(event.data.phone ?? null)
    }

    window.addEventListener('message', handler)
    window.parent.postMessage({ type: 'VOE_GET_CURRENT_CHAT', id }, '*')
  })
}
