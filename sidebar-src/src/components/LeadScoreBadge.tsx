// LeadScoreBadge.tsx
// Pill "10 · Frio" — mesma lógica do LeadScoreBadge real do dashboard
// (src/components/ui/LeadScoreBadge.tsx): acha a faixa (band) em que o
// score cai e mostra número + label + cor da faixa.

import type { ScoreBand } from '../hooks/useLeadScoringConfig'

interface Props {
  score: number
  bands: ScoreBand[]
}

function getBandForScore(bands: ScoreBand[], score: number): ScoreBand | null {
  return bands.find(b => score >= b.min && score <= b.max) ?? null
}

export function LeadScoreBadge({ score, bands }: Props) {
  const band = getBandForScore(bands, score)
  const color = band?.color ?? '#94a3b8'

  return (
    <span
      className="lead-score-badge"
      style={{ backgroundColor: `${color}26`, color }}
      title={band ? `${score} pontos — ${band.label}` : `${score} pontos`}
    >
      <span className="lead-score-dot" style={{ background: color }} />
      {score}
      {band && <span className="lead-score-label">· {band.label}</span>}
    </span>
  )
}
