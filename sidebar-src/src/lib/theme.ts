export type Theme = 'light' | 'dark'

// Compartilhada com content.js para o botão lateral acompanhar o iframe.
const THEME_KEY = 'voe-ext-theme'
let currentTheme: Theme = 'light'
const listeners = new Set<() => void>()

function applyTheme(value: unknown) {
  currentTheme = value === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.voeTheme = currentTheme
  for (const listener of listeners) listener()
}

export async function initializeTheme() {
  let changed = false
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && THEME_KEY in changes) {
      changed = true
      applyTheme(changes[THEME_KEY].newValue)
    }
  })
  try {
    const stored = await chrome.storage.local.get(THEME_KEY)
    if (!changed) applyTheme(stored[THEME_KEY])
  } catch {
    if (!changed) applyTheme('light')
  }
}

export function getTheme() { return currentTheme }

export function subscribeTheme(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export async function setTheme(theme: Theme) {
  await chrome.storage.local.set({ [THEME_KEY]: theme })
  applyTheme(theme)
}
