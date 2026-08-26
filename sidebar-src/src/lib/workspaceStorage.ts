// workspaceStorage.ts
// Persistência em chrome.storage.local do workspace ativo escolhido pelo
// usuário + um token de API por workspace (não um token global único —
// um usuário pode ter mais de um workspace, e cada um precisa do seu
// próprio token voe_xxxx).
//
// Tudo é namespaced por userId (o id da sessão do Supabase). Sem isso, se
// duas contas diferentes usassem a mesma instalação da extensão, a segunda
// herdaria silenciosamente o workspace/token da primeira.

export interface ActiveWorkspace {
  id: string
  name: string
}

function activeWorkspaceKey(userId: string): string {
  return `voe-ext-active-workspace:${userId}`
}

function workspaceTokensKey(userId: string): string {
  return `voe-ext-workspace-tokens:${userId}`
}

export async function getActiveWorkspace(userId: string): Promise<ActiveWorkspace | null> {
  const key = activeWorkspaceKey(userId)
  const result = await chrome.storage.local.get(key)
  return result[key] ?? null
}

export async function setActiveWorkspace(userId: string, workspace: ActiveWorkspace): Promise<void> {
  await chrome.storage.local.set({ [activeWorkspaceKey(userId)]: workspace })
}

export async function clearActiveWorkspace(userId: string): Promise<void> {
  await chrome.storage.local.remove(activeWorkspaceKey(userId))
}

async function getTokenMap(userId: string): Promise<Record<string, string>> {
  const key = workspaceTokensKey(userId)
  const result = await chrome.storage.local.get(key)
  return result[key] ?? {}
}

export async function getWorkspaceToken(userId: string, workspaceId: string): Promise<string | null> {
  const map = await getTokenMap(userId)
  return map[workspaceId] ?? null
}

export async function setWorkspaceToken(userId: string, workspaceId: string, token: string): Promise<void> {
  const map = await getTokenMap(userId)
  map[workspaceId] = token
  await chrome.storage.local.set({ [workspaceTokensKey(userId)]: map })
}

export async function clearWorkspaceToken(userId: string, workspaceId: string): Promise<void> {
  const map = await getTokenMap(userId)
  delete map[workspaceId]
  await chrome.storage.local.set({ [workspaceTokensKey(userId)]: map })
}

/** Limpa tudo desse usuário — usado no logout. */
export async function clearAllWorkspaceData(userId: string): Promise<void> {
  await chrome.storage.local.remove([activeWorkspaceKey(userId), workspaceTokensKey(userId)])
}
