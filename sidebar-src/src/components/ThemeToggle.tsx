import { useState, useSyncExternalStore } from 'react'
import { getTheme, setTheme, subscribeTheme } from '../lib/theme'
import { SunIcon } from './Icons'

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const label = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'

  async function toggle() {
    setSaving(true)
    setError(false)
    try { await setTheme(theme === 'dark' ? 'light' : 'dark') }
    catch { setError(true) }
    finally { setSaving(false) }
  }

  return <div className="theme-toggle-wrap">
    <button type="button" className="theme-toggle" title={label} aria-label={label}
      disabled={saving} onClick={() => void toggle()}>
      {theme === 'dark' ? <SunIcon size={16} /> : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z" />
        </svg>
      )}
    </button>
    {error && <span className="theme-toggle-error" role="alert">Não foi possível salvar o tema. Tente novamente.</span>}
  </div>
}
