import { useCallback, useEffect, useState } from 'react'
import type { ApiScope } from '../lib/apiClient'
import type { CenterType } from '../lib/messageCenter'

export interface CenterPreferences {
  type: CenterType
  search: string
  categories: string[]
  filter: 'all' | 'favorites' | 'recent'
  recent: string[]
  scrollTop: number
}
const initial: CenterPreferences = { type: 'all', search: '', categories: [], filter: 'all', recent: [], scrollTop: 0 }
function restorePreferences(value: Partial<CenterPreferences> & { category?: string }): CenterPreferences {
  return { ...initial, ...value, categories: value.categories ?? (value.category ? [value.category] : []) }
}
const memory = new Map<string, CenterPreferences>()
const subscribers = new Set<() => void>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function useMessageCenterPreferences(scope: ApiScope) {
  const key = `voe-center-prefs:${scope.userId}:${scope.workspaceId}`
  const [, render] = useState(0)
  const preferences = memory.get(key) ?? initial
  useEffect(() => {
    let active = true
    const update = () => { if (active) render(n => n + 1) }
    subscribers.add(update)
    void chrome.storage.session.get(key).then(stored => {
      if (!memory.has(key) && stored[key]) {
        memory.set(key, restorePreferences(stored[key]))
        update()
      }
    }).catch(() => {})
    function onStorage(changes: Record<string, chrome.storage.StorageChange>, area: string) {
      if (area !== 'session' || !changes[key]?.newValue || timers.has(key)) return
      memory.set(key, restorePreferences(changes[key].newValue))
      update()
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => { active = false; subscribers.delete(update); chrome.storage.onChanged.removeListener(onStorage) }
  }, [key])
  const setPreferences = useCallback((patch: Partial<CenterPreferences>) => {
    const next = { ...(memory.get(key) ?? initial), ...patch }
    memory.set(key, next)
    for (const subscriber of subscribers) subscriber()
    clearTimeout(timers.get(key))
    timers.set(key, setTimeout(() => {
      timers.delete(key)
      void chrome.storage.session.set({ [key]: memory.get(key) }).catch(() => {})
    }, 120))
  }, [key])
  return [preferences, setPreferences] as const
}
