import { supabase } from './supabaseClient'
import { SUPABASE_URL } from '../config'
import { voeApi, type ApiScope } from './apiClient'

function hasUsableSignedUrl(url: URL): boolean {
  if (!url.pathname.includes('/object/sign/')) return false
  try {
    const payload = url.searchParams.get('token')?.split('.')[1]
    if (!payload) return false
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    // Apenas uma dica de validade para evitar renovação desnecessária.
    // A assinatura e a autorização do download são verificadas pelo Storage.
    return typeof claims.exp === 'number' && claims.exp * 1000 > Date.now() + 60_000
  } catch { return false }
}

/** Renova pelo modelo salvo usando o mesmo token de workspace da biblioteca. */
export async function resolveLibraryMediaUrl(fileUrl: string, scope: ApiScope, itemId: string): Promise<string> {
  const url = new URL(fileUrl, window.location.href)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Endereço de mídia inválido.')
  if (url.origin !== new URL(SUPABASE_URL).origin) return url.href
  const match = url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public)\/message-library\/(.+)$/)
  if (!match) throw new Error('Arquivo fora da biblioteca de mensagens.')
  const path = decodeURIComponent(match[1])
  if (path.split('/')[0] !== scope.workspaceId || path.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('O arquivo pertence a outro workspace.')
  }
  const { data: auth } = await supabase.auth.getSession()
  if (auth.session?.user.id !== scope.userId) throw new Error('A sessão mudou. Abra a Central novamente.')
  if (hasUsableSignedUrl(url)) return url.href

  if (!itemId) throw new Error('Modelo não encontrado. Atualize a Central de Mensagens.')
  const data = await voeApi.getScoped<{ signedUrl: string }>(
    `/api/v1/message-library/${encodeURIComponent(itemId)}/media-url`, scope,
  )
  if (typeof data?.signedUrl !== 'string' || !data.signedUrl) {
    throw new Error('O servidor não conseguiu renovar o acesso ao arquivo. Tente novamente.')
  }
  return data.signedUrl
}
