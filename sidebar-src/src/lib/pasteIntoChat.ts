// pasteIntoChat.ts
// "Colar na conversa" — ponte pra levar o conteúdo de um item da Central de
// Mensagens até a caixa de digitar do WhatsApp Web de verdade (não é um
// envio automático: só preenche a caixa, igual a um Ctrl+V, e quem manda é
// o próprio usuário clicando o botão de enviar do WhatsApp).
//
// Por que passa por 3 contextos:
// 1. Sidebar (aqui) — roda num iframe cross-origin (chrome-extension://
//    dentro de web.whatsapp.com). Não tem acesso ao DOM da página real.
// 2. background.js — busca o arquivo de mídia (a sidebar não tem bypass de
//    CORS pro Storage do Supabase, mesmo motivo de backgroundFetch.ts) e
//    devolve em base64.
// 3. content.js — roda no mundo isolado da extensão, mas COM acesso ao DOM
//    real do WhatsApp Web. É quem de fato acha a caixa de mensagem e
//    dispara o evento de colar.
//
// A ida sidebar -> content.js é via window.parent.postMessage (o iframe
// falando com a página que o hospeda) — mesmo canal que já existe no
// sentido inverso (content.js -> sidebar) pra WHATSAPP_EVENT, ver
// useActiveChat.ts.

import { sendMessageWithTimeout } from './backgroundFetch'

const PASTE_TIMEOUT_MS = 15_000

interface FetchMediaResult {
  ok: boolean
  base64?: string
  contentType?: string
  error?: string
}

async function fetchMediaBase64(url: string): Promise<{ base64: string; contentType: string }> {
  // Mesmo helper com timeout de backgroundFetch.ts — sem isso, um
  // background.js suspenso no meio da busca deixaria "Colar na conversa"
  // travado pra sempre em vez de virar um erro visível (mesma classe de bug
  // já achada no upload de anexo do agendamento).
  const result = await sendMessageWithTimeout<FetchMediaResult>({
    type: 'VOE_FETCH_MEDIA_BASE64',
    url,
  })
  if (!result?.ok || !result.base64) {
    throw new Error(result?.error || 'Erro ao baixar o arquivo pra colar na conversa')
  }
  return { base64: result.base64, contentType: result.contentType || 'application/octet-stream' }
}

/** Espera a resposta de content.js pra UM pedido específico (correlaciona por `id`). */
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
 * Cola um arquivo de mídia (áudio/imagem/vídeo/documento) na caixa de
 * digitar — o WhatsApp reconhece o arquivo colado e abre o preview de envio
 * dele próprio, do mesmo jeito que reconheceria um Ctrl+V manual.
 */
export async function pasteMediaIntoChat(fileUrl: string, fileName: string): Promise<void> {
  const { base64, contentType } = await fetchMediaBase64(fileUrl)
  return sendToContentScript({ kind: 'file', base64, fileName, mimeType: contentType })
}
