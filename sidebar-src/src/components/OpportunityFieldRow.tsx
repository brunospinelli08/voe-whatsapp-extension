// OpportunityFieldRow.tsx
// Linha "label à esquerda (largura fixa) + valor/editor à direita" — o
// padrão que ContextPanel.tsx usa pra TODOS os campos da oportunidade
// (OppStarField, OppCurrencyField, OppSelectField, OppTextField). Espelha
// esses quatro componentes aqui, na mesma ordem de uso: Qualificação
// (estrelas), Orçamento estimado (moeda), Valor total (somente leitura),
// Origem/Campanha/campos de segmento tipo select (select), campos de
// segmento tipo texto/número/data (texto).

import { useRef, useState } from 'react'

function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (parseInt(digits, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function parseBRL(masked: string): number | null {
  if (!masked) return null
  const n = parseFloat(masked.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}
function formatBRLDisplay(v: number | null | undefined): string {
  if (v == null) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface RowShellProps {
  label: string
  children: React.ReactNode
}

function RowShell({ label, children }: RowShellProps) {
  return (
    <div className="opp-field-row">
      <span className="opp-field-label">{label}</span>
      <div className="opp-field-value">{children}</div>
    </div>
  )
}

/** Linha estática, sem edição — usada pra "Valor total" (calculado a
 * partir dos produtos da oportunidade, não editável direto). */
export function StaticFieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <RowShell label={label}>
      <span className={value ? 'opp-field-static' : 'opp-field-static is-empty'}>{value ?? '—'}</span>
    </RowShell>
  )
}

/** Qualificação — estrelas 1 a 5, com os labels do workspace. */
export function StarFieldRow({
  label, value, labels, onSave,
}: {
  label: string
  value: number | null
  labels: Record<number, string>
  onSave: (value: number | null) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const active = hovered ?? value ?? 0

  return (
    <RowShell label={label}>
      <div className="opp-field-stars">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            className={`qualification-star${star <= active ? ' is-active' : ''}`}
            title={labels[star] ?? `${star} estrela${star > 1 ? 's' : ''}`}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSave(value === star ? null : star)}
          >
            ★
          </button>
        ))}
        {value && <span className="opp-field-star-label">{labels[value] ?? ''}</span>}
      </div>
    </RowShell>
  )
}

/** Orçamento estimado — máscara de moeda BR, salva no blur. */
export function CurrencyFieldRow({
  label, value, onSave,
}: {
  label: string
  value: number | null
  onSave: (value: number | null) => void
}) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const finished = useRef(false)

  function finish(cancel = false) {
    if (finished.current) return
    finished.current = true
    setEditing(false)
    if (!cancel) {
      const next = parseBRL(text)
      if (next !== value) onSave(next)
    }
  }

  return (
    <RowShell label={label}>
      {editing ? (
        <div className="opp-inline-editor">
          <span className="opp-currency-prefix">R$</span>
          <input
            autoFocus
            className="opp-field-input"
            aria-label={label}
            inputMode="decimal"
            placeholder="0,00"
            value={text}
            onChange={e => setText(maskBRL(e.target.value))}
            onBlur={() => finish()}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); finish() }
              if (e.key === 'Escape') { e.preventDefault(); finish(true) }
            }}
          />
          <button type="button" className="opp-edit-cancel" aria-label={`Cancelar edição de ${label}`}
            onMouseDown={e => e.preventDefault()} onClick={() => finish(true)}>×</button>
        </div>
      ) : (
        <button type="button" className={`opp-field-display${value == null ? ' is-empty' : ''}`}
          aria-label={`Editar ${label}`} onClick={() => {
            finished.current = false
            setText(formatBRLDisplay(value))
            setEditing(true)
          }}>
          {value == null ? '—' : `R$ ${formatBRLDisplay(value)}`}
        </button>
      )}
    </RowShell>
  )
}

/** Origem / Campanha / campos de segmento do tipo "select" — mesma
 * dropdown compacta pros três casos. */
export function SelectFieldRow({
  label, value, options, onSave, placeholder = '— selecione —',
}: {
  label: string
  value: string | null
  options: string[]
  onSave: (value: string | null) => void
  placeholder?: string
}) {
  return (
    <RowShell label={label}>
      <select
        className="opp-field-select"
        aria-label={label}
        value={value ?? ''}
        onChange={e => onSave(e.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </RowShell>
  )
}

/** Campos de segmento tipo texto/número/data e campos personalizados de
 * texto/número/data. */
export function TextFieldRow({
  label, value, type = 'text', onSave,
}: {
  label: string
  value: string | null
  type?: 'text' | 'number' | 'date'
  onSave: (value: string | null) => void
}) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const finished = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const display = type === 'date'
    ? value?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')
    : type === 'number' && value && Number.isFinite(Number(value))
      ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 20 }).format(Number(value))
      : value

  function finish(cancel = false) {
    if (finished.current) return
    if (!cancel && inputRef.current && !inputRef.current.reportValidity()) return
    finished.current = true
    setEditing(false)
    if (!cancel && (text || null) !== (value || null)) onSave(text || null)
  }

  return (
    <RowShell label={label}>
      {editing ? (
        <div className="opp-inline-editor">
          <input
            ref={inputRef}
            autoFocus
            className="opp-field-input"
            aria-label={label}
            type={type}
            step={type === 'number' ? 'any' : undefined}
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={() => finish()}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); finish() }
              if (e.key === 'Escape') { e.preventDefault(); finish(true) }
            }}
          />
          <button type="button" className="opp-edit-cancel" aria-label={`Cancelar edição de ${label}`}
            onMouseDown={e => e.preventDefault()} onClick={() => finish(true)}>×</button>
        </div>
      ) : (
        <button type="button" className={`opp-field-display${!value ? ' is-empty' : ''}`}
          aria-label={`Editar ${label}`} onClick={() => {
            finished.current = false
            setText(value ?? '')
            setEditing(true)
          }}>
          {display || '—'}
        </button>
      )}
    </RowShell>
  )
}

/** Checkbox de linha única — campos de segmento/personalizados booleanos
 * (ex: "Data é flexível?"). */
export function BooleanFieldRow({
  label, value, onSave,
}: {
  label: string
  value: boolean
  onSave: (value: boolean) => void
}) {
  return (
    <RowShell label={label}>
      <input
        className="opp-field-checkbox"
        aria-label={label}
        type="checkbox"
        checked={value}
        onChange={e => onSave(e.target.checked)}
      />
    </RowShell>
  )
}
