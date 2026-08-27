// activityDatePresets.ts
// Réplica exata da lógica de presets de SmartDatePicker.tsx (app.voeops.com)
// pro conjunto "base" (usado por task/meeting/visit — a extensão não cria
// atividades whatsapp/email, que usam um conjunto de presets diferente lá).
// Conferido linha a linha contra o componente real antes de portar.

export interface DatePreset {
  label: string
  getDateTime: () => { date: string; time: string }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Arredonda pra próxima meia hora — mesma regra do real: minuto <=30 vira
 * :30, senão pula pra hora cheia seguinte. */
function roundToNextHalfHour(d: Date): Date {
  const out = new Date(d)
  const mins = out.getMinutes()
  if (mins <= 30) out.setMinutes(30, 0, 0)
  else out.setHours(out.getHours() + 1, 0, 0, 0)
  return out
}

/** Próxima segunda-feira a partir de refDate (nunca hoje, mesmo se hoje for
 * segunda — `|| 7` no cálculo real força pular pra semana seguinte). */
function getNextMonday(refDate: Date): Date {
  const d = new Date(refDate)
  const diff = (1 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d
}

/** Presets pra task/meeting/visit — mesma ordem e regra do array "base" em
 * SmartDatePicker.tsx. `allowPast` (meeting/visit) prepende "Ontem", igual
 * ao real (`needsManualResult` = true pra esses dois tipos). */
export function buildActivityDatePresets(allowPast: boolean): DatePreset[] {
  const now = new Date()
  const rounded = roundToNextHalfHour(now)
  const currentTimeStr = `${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const presets: DatePreset[] = [
    { label: 'Hoje', getDateTime: () => ({ date: toDateStr(now), time: currentTimeStr }) },
    { label: 'Amanhã 9h', getDateTime: () => ({ date: toDateStr(tomorrow), time: '09:00' }) },
    { label: 'Amanhã 14h', getDateTime: () => ({ date: toDateStr(tomorrow), time: '14:00' }) },
    {
      label: 'Em 1 hora',
      getDateTime: () => {
        const d = new Date(now)
        d.setHours(d.getHours() + 1)
        const r = roundToNextHalfHour(d)
        return { date: toDateStr(r), time: `${pad(r.getHours())}:${pad(r.getMinutes())}` }
      },
    },
    { label: 'Próx. segunda', getDateTime: () => ({ date: toDateStr(getNextMonday(now)), time: '09:00' }) },
    {
      label: 'Próx. semana',
      getDateTime: () => {
        const d = new Date(now)
        d.setDate(d.getDate() + 7)
        return { date: toDateStr(d), time: currentTimeStr }
      },
    },
  ]

  if (allowPast) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    presets.unshift({ label: 'Ontem', getDateTime: () => ({ date: toDateStr(yesterday), time: '09:00' }) })
  }

  return presets
}

/** Mesmo texto relativo do real (formatRelativeLabel), versão simplificada
 * (sem os casos "atrasada"/plural que a extensão não precisa mostrar). */
export function formatRelativeLabel(dateStr: string, timeStr: string): string | null {
  if (!dateStr) return null
  const now = new Date()
  const target = new Date(`${dateStr}T${timeStr || '12:00'}:00`)
  const diffMs = target.getTime() - now.getTime()

  let relative: string
  if (diffMs < 0) relative = 'atrasada'
  else if (diffMs < 60 * 60 * 1000) relative = `em ${Math.round(diffMs / 60000)}min`
  else if (diffMs < 24 * 60 * 60 * 1000) relative = `em ${Math.round(diffMs / 3600000)}h`
  else {
    const days = Math.round(diffMs / 86400000)
    relative = days === 1 ? 'amanhã' : `em ${days} dias`
  }

  const todayStr = toDateStr(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayLabel = dateStr === todayStr ? 'Hoje' : dateStr === toDateStr(tomorrow) ? 'Amanhã' : target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return `${dayLabel}${timeStr ? ` às ${timeStr}` : ''} — ${relative}`
}
