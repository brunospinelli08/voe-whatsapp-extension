// chromeStorageAdapter.ts
// Adaptador de storage pro cliente do Supabase usar chrome.storage.local em
// vez de localStorage — exigência do projeto: extensões Chrome devem usar a
// Storage API própria, não localStorage. O SDK do Supabase aceita qualquer
// objeto que implemente getItem/setItem/removeItem (podem retornar Promise).

export const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key)
    return result[key] ?? null
  },

  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },

  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  },
}
