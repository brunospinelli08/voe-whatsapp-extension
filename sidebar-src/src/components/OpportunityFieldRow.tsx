// OpportunityFieldRow.tsx
// Linha "label à esquerda (largura fixa) + valor/editor à direita" — o
// padrão que ContextPanel.tsx usa pra TODOS os campos da oportunidade
// (OppStarField, OppCurrencyField, OppSelectField, OppTextField). Espelha
// esses quatro componentes aqui, na mesma ordem de uso: Qualificação
// (estrelas), Orçamento estimado (moeda), Valor total (somente leitura),
// Origem/Campanha/campos de segmento tipo select (select), campos de
// segmento tipo texto/número/data (texto).

import { useState } from 'react'

function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (parseInt(digits, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function parseBRL(masked: string): number | null {
  if (!masked) return null
  const n = parseFloat(masked.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}
function formatBRLDisplay(v: number | null | undefined): string {
  if (v == null || v === 0) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
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
  const [text, setText] = useState(formatBRLDisplay(value))
  const [editing, setEditing] = useState(false)

  function commit() {
    setEditing(false)
    onSave(parseBRL(text))
  }

  return (
    <RowShell label={label}>
      <input
        className="opp-field-input"
        inputMode="numeric"
        placeholder="0,00"
        value={editing ? text : formatBRLDisplay(value) || ''}
        onFocus={() => { setEditing(true); setText(formatBRLDisplay(value)) }}
        onChange={e => setText(maskBRL(e.target.value))}
        onBlur={commit}
      />
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
  const [text, setText] = useState(value ?? '')

  return (
    <RowShell label={label}>
      <input
        className="opp-field-input"
        type={type}
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => onSave(text || null)}
      />
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
        type="checkbox"
        checked={value}
        onChange={e => onSave(e.target.checked)}
      />
    </RowShell>
  )
}
