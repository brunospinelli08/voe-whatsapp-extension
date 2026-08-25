// apiClient.ts
// Cliente fino pras rotas /api/v1/* do app.voeops.com, autenticado com o
// token de workspace (ver voeToken.ts). Se o token salvo tiver sido
// revogado (401), descarta e tenta gerar um novo uma vez antes de desistir.

import { VOE_API_BASE } from '../config'
import { clearVoeToken, getVoeToken } from './voeToken'
import { supabase } from './supabaseClient'

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}, retrying = false): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new ApiError('Sessão expirada, faça login novamente.', 401)

  const voeToken = await getVoeToken(accessToken)

  const res = await fetch(`${VOE_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${voeToken}`,
      ...init.headers,
    },
  })

  if (res.status === 401 && !retrying) {
    // Token de workspace pode ter sido revogado manualmente no dashboard —
    // limpa e tenta uma vez gerar um novo antes de propagar o erro.
    await clearVoeToken()
    return request<T>(path, init, true)
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(body.error || `Erro ${res.status} em ${path}`, res.status)
  }
  return body as T
}

export const voeApi = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
}

export { ApiError }
