import { sendMessageWithTimeout } from './backgroundFetch'
import { base64ToFile, fileToBase64 } from './fileBase64'
import { prepareVoiceAudio } from './voiceAudio'
import type { ApiScope } from './apiClient'

interface FetchMediaResult { ok: boolean; base64?: string; contentType?: string; error?: string }
export interface PasteResult { confirmed: boolean }
interface ChatResult { phone: string | null; revision: number }

function requestParent<T>(type: string, replyType: string, payload?: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `voe-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timeout = setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error(timeoutMs > 8000 ? 'Envio sem confirmação. Confira a conversa antes de tentar novamente.' : 'O WhatsApp não respondeu. Aguarde e tente novamente.'))
    }, timeoutMs)
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.data?.type !== replyType || event.data.id !== id) return
      clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      if (event.data.ok === false) reject(new Error(event.data.error || 'Não foi possível inserir na conversa.'))
      else resolve(event.data as T)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type, id, payload }, '*')
  })
}

async function verifyChat(expectedPhone: string): Promise<ChatResult> {
  const chat = await requestParent<ChatResult>('VOE_GET_CURRENT_CHAT', 'VOE_CURRENT_CHAT_RESULT')
  if (!expectedPhone || chat.phone !== expectedPhone) throw new Error('A conversa mudou ou não pôde ser confirmada. Abra o contato correto e tente novamente.')
  return chat
}

/** Insere sem substituir o rascunho; o envio final continua no WhatsApp. */
export async function pasteTextIntoChat(text: string, expectedPhone: string, scope?: ApiScope, signal?: AbortSignal): Promise<PasteResult> {
  if (!text.trim()) throw new Error('Este modelo não tem texto para inserir.')
  const chat = await verifyChat(expectedPhone)
  signal?.throwIfAborted()
  return requestParent('VOE_PASTE_INTO_CHAT', 'VOE_PASTE_RESULT', { kind: 'text', text, expectedPhone, revision: chat.revision, scope })
}

/** Confere a conversa antes do download e novamente no instante do envio. */
export async function sendMediaIntoChat(fileUrl: string, fileName: string, mediaType: string, caption: string, expectedPhone: string, scope: ApiScope, signal?: AbortSignal): Promise<PasteResult> {
  const chat = await verifyChat(expectedPhone)
  signal?.throwIfAborted()
  const result = await sendMessageWithTimeout<FetchMediaResult>({ type: 'VOE_FETCH_MEDIA_BASE64', url: fileUrl })
  signal?.throwIfAborted()
  if (!result?.ok || !result.base64) throw new Error(result?.error || 'Erro ao preparar o arquivo. Tente atualizar a biblioteca.')
  let base64 = result.base64
  let mimeType = result.contentType || 'application/octet-stream'
  if (mediaType === 'audio') {
    const voice = await prepareVoiceAudio(base64ToFile(base64, fileName, mimeType), signal)
    signal?.throwIfAborted()
    base64 = await fileToBase64(voice)
    mimeType = voice.type
    fileName = `${fileName.replace(/\.[^.]+$/, '') || 'audio'}.ogg`
  }
  signal?.throwIfAborted()
  return requestParent('VOE_PASTE_INTO_CHAT', 'VOE_PASTE_RESULT', {
    kind: 'file', base64, fileName, mimeType,
    expectedPhone, revision: chat.revision, scope, mediaType, caption,
  }, 95000)
}
