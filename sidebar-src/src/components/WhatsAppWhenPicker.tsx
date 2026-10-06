// WhatsAppWhenPicker.tsx
// "Quando *" do agendamento de WhatsApp — o ramo `activityType="whatsapp"`
// do SmartDatePicker.tsx do dashboard: presets com ícone (Em 1 hora, manhã
// 7h/8h/9h, Próx. segunda, Próx. semana), "Personalizar" com mini-calendário
// + hora, e o chip de horário relativo. Saiu de dentro do antigo
// ScheduleMessagePanel.tsx sem mudar o visual.

import { useState } from 'react'
import {
  buildWhatsAppDatePresets, formatWhatsAppRelativeLabel,
  getDaysInMonth, getFirstDayOfWeek, WEEKDAY_INITIALS, MONTH_NAMES,
  type WhatsAppDatePreset,
} from '../lib/whatsappDatePresets'
import {
  ArrowRightIcon, CalendarDaysIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, SunIcon,
} from './Icons'

const PRESET_ICONS = { clock: ClockIcon, sun: SunIcon, calendarDays: CalendarDaysIcon, arrowRight: ArrowRightIcon }

const pad = (n: number) => String(n).padStart(2, '0')

interface Props {
  date: string
  time: string
  onChange: (date: string, time: string) => void
  error?: boolean
}

export function WhatsAppWhenPicker({ date, time, onChange, error }: Props) {
  const [showCalendar, setShowCalendar] = useState(false)
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const presets = buildWhatsAppDatePresets()
  const relativeLabel = formatWhatsAppRelativeLabel(date, time)
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  function applyPreset(preset: WhatsAppDatePreset) {
    const next = preset.getDateTime()
    onChange(next.date, next.time)
    setShowCalendar(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) } else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) } else setViewMonth(viewMonth + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)

  return (
    <div className="schedule-when">
      <div className="schedule-when-header">
        <span className="form-label-standalone">
          <CalendarIcon size={12} /> Quando *
        </span>
        {date && !showCalendar && (
          <button type="button" className="link-button" onClick={() => setShowCalendar(true)}>
            Personalizar
          </button>
        )}
      </div>

      <div className="schedule-presets">
        {presets.map(preset => {
          const p = preset.getDateTime()
          const isActive = date === p.date && time === p.time
          const PresetIcon = PRESET_ICONS[preset.icon]
          return (
            <button key={preset.label} type="button"
              className={`schedule-preset-pill${isActive ? ' is-active' : ''}`}
              onClick={() => applyPreset(preset)}>
              <PresetIcon size={12} />
              {preset.label}
            </button>
          )
        })}
        {!showCalendar && (
          <button type="button" className="schedule-preset-pill" onClick={() => setShowCalendar(true)}>
            <CalendarIcon size={12} /> Personalizar
          </button>
        )}
      </div>

      {showCalendar && (
        <div className="schedule-calendar-card">
          <div className="schedule-calendar-nav">
            <button type="button" onClick={prevMonth}><ChevronLeftIcon size={14} /></button>
            <span>{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth}><ChevronRightIcon size={14} /></button>
          </div>
          <div className="schedule-calendar-weekdays">
            {WEEKDAY_INITIALS.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="schedule-calendar-days">
            {Array.from({ length: firstDay }).map((_, i) => <span key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
              const isSelected = dayStr === date
              return (
                <button key={day} type="button" disabled={dayStr < todayStr}
                  onClick={() => onChange(dayStr, time || '09:00')}
                  className={`schedule-calendar-day${isSelected ? ' is-selected' : dayStr === todayStr ? ' is-today' : ''}`}>
                  {day}
                </button>
              )
            })}
          </div>
          <div className="schedule-calendar-footer">
            <span>Horário:</span>
            {/* Mexer só na hora sem ter clicado um dia assume hoje — senão a
                data ficava vazia e o envio travava sem motivo aparente. */}
            <input type="time" value={time} onChange={e => onChange(date || todayStr, e.target.value)} />
            <button type="button" className="link-button" onClick={() => setShowCalendar(false)}>Fechar</button>
          </div>
        </div>
      )}

      {date && relativeLabel && (
        <div className={`schedule-relative-chip${relativeLabel.includes('atrasada') ? ' is-late' : ''}`}>
          <CalendarIcon size={12} />
          {relativeLabel}
        </div>
      )}
      {error && !date && <p className="error-text">Selecione uma data para o envio</p>}
    </div>
  )
}
