// workspaceStorage.ts
// Persistência em chrome.storage.local do workspace ativo escolhido pelo
// usuário + um token de API por workspace (não um token global único —
// um usuário pode ter mais de um workspace, e cada um precisa do seu
// próprio token voe_xxxx).

const ACTIVE_WORKSPACE_KEY = 'voe-ext-active-workspace'
const WORKSPACE_TOKENS_KEY = 'voe-ext-workspace-tokens'

export interface ActiveWorkspace {
  id: string
  name: string
}

export async function getActiveWorkspace(): Promise<ActiveWorkspace | null> {
  const result = await chrome.storage.local.get(ACTIVE_WORKSPACE_KEY)
  return result[ACTIVE_WORKSPACE_KEY] ?? null
}

export async function setActiveWorkspace(workspace: ActiveWorkspace): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_WORKSPACE_KEY]: workspace })
}

export async function clearActiveWorkspace(): Promise<void> {
  await chrome.storage.local.remove(ACTIVE_WORKSPACE_KEY)
}

async function getTokenMap(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get(WORKSPACE_TOKENS_KEY)
  return result[WORKSPACE_TOKENS_KEY] ?? {}
}

export async function getWorkspaceToken(workspaceId: string): Promise<string | null> {
  const map = await getTokenMap()
  return map[workspaceId] ?? null
}

export async function setWorkspaceToken(workspaceId: string, token: string): Promise<void> {
  const map = await getTokenMap()
  map[workspaceId] = token
  await chrome.storage.local.set({ [WORKSPACE_TOKENS_KEY]: map })
}

export async function clearWorkspaceToken(workspaceId: string): Promise<void> {
  const map = await getTokenMap()
  delete map[workspaceId]
  await chrome.storage.local.set({ [WORKSPACE_TOKENS_KEY]: map })
}

/** Limpa tudo — usado no logout. */
export async function clearAllWorkspaceData(): Promise<void> {
  await chrome.storage.local.remove([ACTIVE_WORKSPACE_KEY, WORKSPACE_TOKENS_KEY])
}
