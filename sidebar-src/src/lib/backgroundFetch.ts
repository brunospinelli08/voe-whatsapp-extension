// backgroundFetch.ts
// Substituto do fetch() direto pra chamadas ao app.voeops.com. A sidebar
// roda num iframe embutido no web.whatsapp.com — esse contexto NÃO ganha o
// bypass de CORS do host_permissions (só o service worker e abas em
// primeiro plano da extensão ganham). Então em vez de fetch() daqui,
// mandamos a request pro background.js via chrome.runtime.sendMessage, que
// executa o fetch de verdade (com o bypass) e devolve o resultado.
//
// Retorna um Response de verdade (via o construtor Response, disponível no
// iframe) pra quem chama continuar usando res.ok / res.status / res.json()
// normalmente, sem precisar saber que por baixo é uma mensagem.

import { fileToBase64 } from './fileBase64'

// Sem timeout, chrome.runtime.sendMessage pode ficar pendurada pra sempre se
// o service worker travar/for suspenso no meio de uma request (o fetch()
// dentro de background.js não tem timeout próprio) — o achado real: o botão
// "Agendar envio" às vezes ficava desabilitado "sem motivo nenhum", porque
// `saving`/`uploading` (em ScheduleMessagePanel.tsx) nunca voltavam a false —
// a promise que os resetaria no `finally` simplesmente nunca resolvia nem
// rejeitava. Com o timeout, o pior caso vira um erro visível e recuperável
// em até 25s, não um travamento silencioso indefinido.
const MESSAGE_TIMEOUT_MS = 25_000

function sendMessageWithTimeout<T>(message: unknown): Promise<T> {
  return Promise.race([
    chrome.runtime.sendMessage(message) as Promise<T>,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('A extensão demorou demais para responder. Tente de novo.')), MESSAGE_TIMEOUT_MS),
    ),
  ])
}

interface BackgroundFetchMessage {
  type: 'VOE_API_FETCH'
  url: string
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }
}

interface BackgroundFetchResult {
  ok: boolean
  status?: number
  body?: string
  error?: string
}

export async function backgroundFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const message: BackgroundFetchMessage = {
    type: 'VOE_API_FETCH',
    url,
    init: {
      method: init.method,
      headers: init.headers as Record<string, string> | undefined,
      body: typeof init.body === 'string' ? init.body : undefined,
    },
  }

  const result = await sendMessageWithTimeout<BackgroundFetchResult>(message)

  if (!result?.ok) {
    throw new Error(result?.error || 'Erro de rede desconhecido ao falar com o background')
  }

  return new Response(result.body, { status: result.status })
}

/**
 * Upload de arquivo (multipart) via o mesmo proxy do background.js.
 *
 * Por quê não dá pra só passar um FormData pro backgroundFetch: a ponte
 * chrome.runtime.sendMessage só carrega string hoje (ver comentário acima
 * e VOE_API_FETCH em background.js — body é sempre string ou undefined).
 * Um File/Blob dentro de FormData não sobrevive a isso. Solução: converte o
 * arquivo pra base64 aqui, manda como string na mensagem, e o background.js
 * reconstrói um Blob de verdade lá (contexto de service worker, com FormData
 * e fetch completos) antes de montar a request multipart de verdade.
 *
 * Limite prático de 15MB (mais conservador que o limite do servidor — até
 * 100MB pra documento): base64 infla ~33% o tamanho, e arquivo grande demais
 * na mensagem trava a UI durante a codificação/serialização. Documentos
 * maiores continuam dando pra anexar pelo dashboard normal, sem esse
 * intermediário.
 */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

export async function backgroundUploadFile(
  url: string,
  file: File,
  fields: Record<string, string>,
  headers: Record<string, string>,
): Promise<Response> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Arquivo muito grande pra anexar pela extensão (máx. ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).`)
  }

  const fileBase64 = await fileToBase64(file)

  const message = {
    type: 'VOE_API_UPLOAD',
    url,
    headers,
    fields,
    fileBase64,
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
  }

  const result = await sendMessageWithTimeout<BackgroundFetchResult>(message)

  if (!result?.ok) {
    throw new Error(result?.error || 'Erro de rede desconhecido ao enviar o arquivo')
  }

  return new Response(result.body, { status: result.status })
}
