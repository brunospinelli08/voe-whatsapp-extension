// QualificationPicker.tsx
// Seletor de Qualificação por estrelas (1-5), com os labels configurados
// no workspace (useQualificationLabels) — mesmo conceito do StarPicker
// real do dashboard. Sem ícone de biblioteca externa (★ é só texto).

import { useState } from 'react'

interface Props {
  value: number | null
  onChange: (value: number | null) => void
  labels: Record<number, string>
}

export function QualificationPicker({ value, onChange, labels }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const active = hovered ?? value ?? 0

  return (
    <div className="qualification-picker">
      <div className="qualification-picker-stars">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            className={`qualification-star${star <= active ? ' is-active' : ''}`}
            title={labels[star] ?? `${star} estrela${star > 1 ? 's' : ''}`}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(value === star ? null : star)}
          >
            ★
          </button>
        ))}
      </div>
      {value && <span className="muted">{labels[value] ?? `${value} estrelas`}</span>}
    </div>
  )
}
