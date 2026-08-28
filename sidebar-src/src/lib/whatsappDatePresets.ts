// whatsappDatePresets.ts
// Réplica exata do ramo `type === "whatsapp"` de buildPresets/buildTimeSlots/
// formatRelativeLabel em SmartDatePicker.tsx (app.voeops.com) — o real usa um
// conjunto de presets diferente pra envio de mensagem (foco em horários da
// manhã, sem "Hoje = agora") do que pra tarefa/reunião/visita
// (activityDatePresets.ts, conjunto "base", já portado antes). Conferido
// linha a linha contra o componente real antes de portar.

export interface WhatsAppDatePreset {
  label: string
  icon: 'clock' | 'sun' | 'calendarDays' | 'arrowRight'
  getDateTime: () => { date: string; time: string }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function roundToNextHalfHour(d: Date): Date {
  const out = new Date(d)
  const mins = out.getMinutes()
  if (mins <= 30) out.setMinutes(30, 0, 0)
  else out.setHours(out.getHours() + 1, 0, 0, 0)
  return out
}

/** Próxima segunda-feira a partir de refDate (nunca hoje — `|| 7` força pular pra semana seguinte). */
function getNextMonday(refDate: Date): Date {
  const d = new Date(refDate)
  const diff = (1 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Presets pra agendamento de WhatsApp — mesma ordem/regra do real:
 * "Em 1 hora", manhã (7h/8h/9h — resolve pra HOJE se a hora ainda não
 * passou, senão AMANHÃ, com rótulo dinâmico), "Próx. segunda", "Próx. semana".
 */
export function buildWhatsAppDatePresets(): WhatsAppDatePreset[] {
  const now = new Date()

  const morning = (hour: number): WhatsAppDatePreset => {
    const target = new Date(now)
    target.setHours(hour, 0, 0, 0)
    const isToday = target > now
    if (!isToday) target.setDate(target.getDate() + 1)
    const dateStr = toDateStr(target)
    const timeStr = `${pad(hour)}:00`
    return {
      label: `${isToday ? 'Hoje' : 'Amanhã'} ${hour}h`,
      icon: 'sun',
      getDateTime: () => ({ date: dateStr, time: timeStr }),
    }
  }

  return [
    {
      label: 'Em 1 hora',
      icon: 'clock',
      getDateTime: () => {
        const d = new Date(now)
        d.setHours(d.getHours() + 1)
        const r = roundToNextHalfHour(d)
        return { date: toDateStr(r), time: `${pad(r.getHours())}:${pad(r.getMinutes())}` }
      },
    },
    morning(7),
    morning(8),
    morning(9),
    {
      label: 'Próx. segunda',
      icon: 'calendarDays',
      getDateTime: () => ({ date: toDateStr(getNextMonday(now)), time: '09:00' }),
    },
    {
      label: 'Próx. semana',
      icon: 'arrowRight',
      getDateTime: () => {
        const d = new Date(now)
        d.setDate(d.getDate() + 7)
        return { date: toDateStr(d), time: '09:00' }
      },
    },
  ]
}

const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Réplica do formatRelativeLabel do SmartDatePicker real — rótulo de dia com prefixo de dia da semana (ex.: "seg, 02/09"). */
export function formatWhatsAppRelativeLabel(dateStr: string, timeStr: string): string | null {
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
  const tomorrowStr = toDateStr(tomorrow)

  const dayStr = WEEKDAYS_SHORT[target.getDay()]
  const dateFormatted = target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const dayLabel = dateStr === todayStr ? 'Hoje' : dateStr === tomorrowStr ? 'Amanhã' : `${dayStr}, ${dateFormatted}`

  return `${dayLabel}${timeStr ? ` às ${timeStr}` : ''} — ${relative}`
}

// ── Mini-calendário (Personalizar) ──────────────────────────────────────────

export const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}
