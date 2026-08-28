// apiClient.ts
// Cliente fino pras rotas /api/v1/* do app.voeops.com, autenticado com o
// token do workspace ATIVO (ver voeToken.ts / workspaceStorage.ts). Se o
// token salvo tiver sido revogado (401), descarta e tenta gerar um novo
// uma vez antes de desistir.

import { VOE_API_BASE } from '../config'
import { clearVoeToken, getVoeToken } from './voeToken'
import { supabase } from './supabaseClient'
import { backgroundFetch, backgroundUploadFile } from './backgroundFetch'
import { getActiveWorkspace } from './workspaceStorage'

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Resolve o token do workspace ativo — mesma checagem usada por request() e requestUpload(). */
async function resolveVoeToken(): Promise<{ voeToken: string; userId: string; workspaceId: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  const userId = sessionData.session?.user.id
  if (!accessToken || !userId) throw new ApiError('Sessão expirada, faça login novamente.', 401)

  const activeWorkspace = await getActiveWorkspace(userId)
  if (!activeWorkspace) throw new ApiError('Nenhum workspace selecionado.', 400)

  const voeToken = await getVoeToken(accessToken, userId, activeWorkspace.id)
  return { voeToken, userId, workspaceId: activeWorkspace.id }
}

async function request<T>(path: string, init: RequestInit = {}, retrying = false): Promise<T> {
  const { voeToken, userId, workspaceId } = await resolveVoeToken()

  const res = await backgroundFetch(`${VOE_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${voeToken}`,
      ...init.headers,
    },
  })

  if (res.status === 401 && !retrying) {
    // Token desse workspace pode ter sido revogado manualmente no
    // dashboard — limpa e tenta uma vez gerar um novo antes de propagar o
    // erro.
    await clearVoeToken(userId, workspaceId)
    return request<T>(path, init, true)
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(body.error || `Erro ${res.status} em ${path}`, res.status)
  }
  return body as T
}

/**
 * Upload de arquivo — mesma autenticação de request(), mas via
 * backgroundUploadFile (a ponte de mensagens não carrega FormData/Blob de
 * forma confiável, ver comentário em backgroundFetch.ts).
 */
async function requestUpload<T>(
  path: string, file: File, fields: Record<string, string>, retrying = false,
): Promise<T> {
  const { voeToken, userId, workspaceId } = await resolveVoeToken()

  const res = await backgroundUploadFile(
    `${VOE_API_BASE}${path}`, file, fields, { Authorization: `Bearer ${voeToken}` },
  )

  if (res.status === 401 && !retrying) {
    await clearVoeToken(userId, workspaceId)
    return requestUpload<T>(path, file, fields, true)
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
  upload: <T>(path: string, file: File, fields: Record<string, string> = {}) =>
    requestUpload<T>(path, file, fields),
}

export { ApiError }
