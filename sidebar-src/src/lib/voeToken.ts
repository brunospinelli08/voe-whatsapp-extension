// voeToken.ts
// Ponte sessão-de-usuário -> token de workspace.
//
// As rotas /api/v1/* (opportunities, contacts, etc.) só aceitam o token
// estático de workspace (Authorization: Bearer voe_xxxx), não a sessão do
// Supabase diretamente. Em vez de mudar essas rotas compartilhadas, a
// extensão reaproveita dois endpoints que já existem em app.voeops.com,
// fora de /api/v1/*:
//
//   POST /api/workspaces/select  — troca o workspace ativo do usuário
//                                   (users.workspace_id) pro escolhido
//   POST /api/tokens             — gera um token pro workspace ATUAL do
//                                   usuário (users.workspace_id)
//
// Um usuário pode ter mais de um workspace, então mantemos um token por
// workspace em chrome.storage.local (ver workspaceStorage.ts) — nunca um
// token global único, que seria ambíguo sobre qual conta ele representa.

import { VOE_API_BASE } from '../config'
import { backgroundFetch } from './backgroundFetch'
import { clearWorkspaceToken, getWorkspaceToken, setWorkspaceToken } from './workspaceStorage'

const TOKEN_NAME = 'VOE WhatsApp Extension'

export async function clearVoeToken(userId: string, workspaceId: string): Promise<void> {
  await clearWorkspaceToken(userId, workspaceId)
}

/** Torna `workspaceId` o workspace ativo do usuário no app.voeops.com (users.workspace_id). */
export async function selectWorkspaceOnServer(
  supabaseAccessToken: string,
  workspaceId: string,
): Promise<void> {
  const res = await backgroundFetch(`${VOE_API_BASE}/api/workspaces/select`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAccessToken}`,
    },
    body: JSON.stringify({ workspace_id: workspaceId }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Falha ao selecionar workspace (${res.status})`)
  }
}

/** Gera um novo token pro workspace atualmente ativo do usuário, via /api/tokens. */
async function mintVoeToken(supabaseAccessToken: string): Promise<string> {
  const res = await backgroundFetch(`${VOE_API_BASE}/api/tokens`, {
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
 * Retorna um token válido pro workspace `workspaceId`, reaproveitando o
 * salvo em chrome.storage.local quando existir. Só chama a API (selecionar
 * o workspace no servidor + gerar um token) se não houver um token salvo
 * pra esse workspace ainda.
 */
export async function getVoeToken(
  supabaseAccessToken: string,
  userId: string,
  workspaceId: string,
): Promise<string> {
  const stored = await getWorkspaceToken(userId, workspaceId)
  if (stored) return stored

  await selectWorkspaceOnServer(supabaseAccessToken, workspaceId)
  const fresh = await mintVoeToken(supabaseAccessToken)
  await setWorkspaceToken(userId, workspaceId, fresh)
  return fresh
}
