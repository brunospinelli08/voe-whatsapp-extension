// voeToken.ts
// Ponte sessão-de-usuário -> token de workspace.
//
// As rotas /api/v1/* (opportunities, contacts, etc.) só aceitam o token
// estático de workspace (Authorization: Bearer voe_xxxx), não a sessão do
// Supabase diretamente. Em vez de mudar essas rotas compartilhadas, a
// extensão reaproveita o endpoint /api/tokens (já existente, já autenticado
// por sessão de usuário) pra gerar um token de workspace na primeira vez
// que o usuário loga, e reusa esse token daí em diante.

import { VOE_API_BASE } from '../config'

const STORAGE_KEY = 'voe-ext-api-token'
const TOKEN_NAME = 'VOE WhatsApp Extension'

async function getStoredToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] ?? null
}

async function storeToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: token })
}

export async function clearVoeToken(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

/** Gera um novo token de workspace via /api/tokens, usando a sessão do Supabase. */
async function mintVoeToken(supabaseAccessToken: string): Promise<string> {
  const res = await fetch(`${VOE_API_BASE}/api/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAccessToken}`,
    },
    body: JSON.stringify({ name: TOKEN_NAME }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Falha ao gerar token de workspace (${res.status})`)
  }

  const data = await res.json()
  if (!data.token) throw new Error('Resposta de /api/tokens não trouxe o token')
  return data.token as string
}

/**
 * Retorna um token de workspace válido, reaproveitando o salvo em
 * chrome.storage.local quando existir. Só chama /api/tokens (criando um
 * token novo) se não houver um salvo ainda.
 */
export async function getVoeToken(supabaseAccessToken: string): Promise<string> {
  const stored = await getStoredToken()
  if (stored) return stored

  const fresh = await mintVoeToken(supabaseAccessToken)
  await storeToken(fresh)
  return fresh
}
