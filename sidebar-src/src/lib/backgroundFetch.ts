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

  const result: BackgroundFetchResult = await chrome.runtime.sendMessage(message)

  if (!result?.ok) {
    throw new Error(result?.error || 'Erro de rede desconhecido ao falar com o background')
  }

  return new Response(result.body, { status: result.status })
}
