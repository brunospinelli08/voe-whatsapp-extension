// MessageVariables.tsx
// Réplicas de VariableText, VariableTextarea e VariablePickerButton do
// dashboard (components/ui/VariableText.tsx, components/ui/VariableTextarea.tsx,
// components/automations/builder/VariablePicker.tsx), usadas na seção
// WhatsApp do Nova Atividade:
// - azul  = variável {{...}} (vira o dado do contato no envio)
// - verde = variável que já tem valor pra este contato
// O picker é o "{{ Variáveis ▾" com busca + categorias; abre em
// position: fixed calculado a partir do botão (igual ao real, que usa
// portal) pra não ser cortado pelo scroll do modal. Sem as opções de
// filtro/valor padrão do real.

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  VARIABLE_CATEGORIES, parseVariableSegments, toShortVariableKey, type VariableContext,
} from '../lib/messageVariables'
import { ChevronDownIcon, SearchIcon, XIcon } from './Icons'

function segmentClass(resolved: string | undefined) {
  return resolved ? 'var-token is-filled' : 'var-token'
}

/** Texto somente leitura com as variáveis destacadas (com contexto, já mostra o valor). */
export function VariableText({ text, context }: { text: string | null | undefined; context?: VariableContext | null }) {
  if (!text) return null
  return (
    <>
      {parseVariableSegments(text, context ?? null).map((seg, i) =>
        !seg.isVariable ? <span key={i}>{seg.text}</span>
          : context && seg.resolvedValue
            ? <span key={i} className="var-token is-filled" title={`${seg.text} → ${seg.resolvedValue}`}>{seg.resolvedValue}</span>
            : <span key={i} className="var-token" title={context ? `${seg.text} (sem valor para este contato)` : undefined}>{seg.text}</span>,
      )}
    </>
  )
}

interface TextareaProps {
  value: string
  onValueChange: (value: string) => void
  variableContext?: VariableContext | null
  rows?: number
  placeholder?: string
}

/**
 * Textarea com as variáveis pintadas: uma camada espelho por trás (mesma
 * fonte/padding/quebra) e o textarea transparente por cima. O espelho não
 * troca o token pelo valor — só a cor — pra continuar alinhado letra a letra.
 */
export const VariableTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function VariableTextarea(
  { value, onValueChange, variableContext, rows = 3, placeholder }, ref,
) {
  const mirrorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // Cresce com o conteúdo em vez de rolar: barra de rolagem no textarea
  // estreitaria só ele e desalinharia o espelho.
  useLayoutEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [value])

  function setRefs(el: HTMLTextAreaElement | null) {
    inputRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  return (
    <div className="var-textarea">
      <div className="var-textarea-mirror" ref={mirrorRef} aria-hidden>
        {parseVariableSegments(value, variableContext ?? null).map((seg, i) =>
          seg.isVariable
            ? <span key={i} className={segmentClass(variableContext ? seg.resolvedValue : undefined)}>{seg.text}</span>
            : <span key={i}>{seg.text}</span>,
        )}
        {/* quebra final: sem isso a última linha vazia some do espelho */}
        {'\n'}
      </div>
      <textarea
        ref={setRefs}
        className="var-textarea-input"
        value={value}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        onChange={e => onValueChange(e.target.value)}
      />
    </div>
  )
})

const PANEL_WIDTH = 260
const PANEL_MARGIN = 8

export function VariablePickerButton({ onInsert }: { onInsert: (token: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function openPanel() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const left = Math.max(PANEL_MARGIN, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN))
      const spaceBelow = window.innerHeight - rect.bottom - 4 - PANEL_MARGIN
      const spaceAbove = rect.top - 4 - PANEL_MARGIN
      if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
        setCoords({ top: rect.bottom + 4, left, maxHeight: Math.max(160, Math.min(340, spaceBelow)) })
      } else {
        setCoords({ bottom: window.innerHeight - rect.top + 4, left, maxHeight: Math.max(160, Math.min(340, spaceAbove)) })
      }
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const inside = (t: EventTarget | null) => !!(btnRef.current?.contains(t as Node) || panelRef.current?.contains(t as Node))
    const onDown = (e: MouseEvent) => { if (!inside(e.target)) setOpen(false) }
    const onScroll = (e: Event) => { if (!inside(e.target)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const q = search.toLowerCase()
  const categories = VARIABLE_CATEGORIES
    .map(cat => ({ ...cat, items: cat.items.filter(i => !q || i.key.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)) }))
    .filter(cat => cat.items.length > 0)

  return (
    <>
      <button ref={btnRef} type="button" className={`var-picker-btn${open ? ' is-open' : ''}`}
        onClick={() => (open ? setOpen(false) : openPanel())}>
        <span className="var-picker-braces">{'{{'}</span> Variáveis <ChevronDownIcon size={9} />
      </button>
      {open && coords && (
        <div ref={panelRef} className="var-picker-panel"
          style={{ top: coords.top, bottom: coords.bottom, left: coords.left, width: PANEL_WIDTH, maxHeight: coords.maxHeight }}>
          <div className="var-picker-search">
            <SearchIcon size={11} />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar variável..." />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca"><XIcon size={11} /></button>
            )}
          </div>
          <div className="var-picker-list">
            {categories.length === 0 && <p className="var-picker-empty">Nenhuma variável encontrada</p>}
            {categories.map(cat => (
              <div key={cat.id} className="var-picker-cat">
                <p className="var-picker-cat-label" style={{ color: cat.color }}>{cat.label}</p>
                {cat.items.map(item => {
                  const tokenKey = toShortVariableKey(item.key)
                  return (
                    <button key={item.key} type="button" className="var-picker-item"
                      onClick={() => { onInsert(`{{${tokenKey}}}`); setOpen(false); setSearch('') }}>
                      <code>{`{{${tokenKey}}}`}</code>
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
