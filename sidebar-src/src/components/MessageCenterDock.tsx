import { useEffect, useRef, useState } from 'react'
import { MessageCenterScreen } from './MessageCenterPanel'
import { useMessageCenterPreferences } from '../hooks/useMessageCenterPreferences'
import { CENTER_TYPES, type CenterType, type MessageCenterContext } from '../lib/messageCenter'
import { MessageCircleIcon, MicIcon, ImageIcon, VideoIcon, FileTextIcon, LayersIcon } from './Icons'

const DOCK_TABS = [
  { type: 'text', label: 'Texto', Icon: MessageCircleIcon },
  { type: 'audio', label: 'Áudio', Icon: MicIcon },
  { type: 'image', label: 'Imagem', Icon: ImageIcon },
  { type: 'video', label: 'Vídeo', Icon: VideoIcon },
  { type: 'document', label: 'Doc', Icon: FileTextIcon },
  { type: 'all', label: 'Mais', Icon: LayersIcon },
] as const

function Dock({ context }: { context: MessageCenterContext }) {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useMessageCenterPreferences(context.scope)
  const lastButton = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    window.parent.postMessage({ type: 'VOE_CENTER_SIZE', open }, '*')
  }, [open])
  useEffect(() => { setOpen(false) }, [context.chat?.phone])
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source === window.parent && event.data?.type === 'VOE_CENTER_CLOSE') setOpen(false)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function close() { setOpen(false); lastButton.current?.focus() }
  function select(type: CenterType, button: HTMLButtonElement) {
    lastButton.current = button
    if (open && prefs.type === type) { close(); return }
    setPrefs({ type, scrollTop: prefs.type === type ? prefs.scrollTop : 0 })
    setOpen(true)
  }

  return <div className={`mc-dock${open ? ' is-open' : ''}`}>
    <div className="mc-dock-panel" hidden={!open}>
      <MessageCenterScreen context={context} docked visible={open} onClose={close} />
    </div>
    <nav className="mc-bar" aria-label="Central de Mensagens" onKeyDown={event => { if (event.key === 'Escape') close() }}>
      <span className="mc-bar-label">Central</span>
      {DOCK_TABS.map(({ type, label, Icon }) => <button type="button" key={type}
        title={type === 'all' ? 'Todos os tipos e carrosséis' : CENTER_TYPES.find(t => t.type === type)?.label}
        aria-expanded={open && prefs.type === type} onClick={event => select(type, event.currentTarget)}>
        <Icon size={13} /><span>{label}</span>
      </button>)}
    </nav>
  </div>
}

/** A sidebar fornece apenas o contexto autorizado, sem duplicar o lookup do contato. */
export function MessageCenterDock() {
  const [context, setContext] = useState<MessageCenterContext | null>(null)
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return
      if (event.data?.type === 'VOE_CENTER_CONTEXT') setContext(event.data.context ?? null)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'VOE_CENTER_READY' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])
  return context ? <Dock key={`${context.scope.userId}:${context.scope.workspaceId}`} context={context} /> : null
}
