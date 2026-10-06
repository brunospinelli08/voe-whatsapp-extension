// ActivityCard.tsx
// Réplica da variante "compact" de ActivityCard.tsx do dashboard (a que o
// Inbox usa na aba Atividades): L1 ícone do tipo + título + menu "⋮" (ou
// botão Reativar, pra concluídas/canceladas), L2 status + data + countdown
// + resultado + preview da mensagem WhatsApp. Menu com as mesmas ações:
// Enviar agora, Completar / Registrar resultado (picker inline), Cancelar,
// Adiar (mesmas opções inteligentes) e Excluir com confirmação.
//
// Fora do escopo: "Editar" (no dashboard abre o ActivityModal em modo
// edição; o NewActivityModal da extensão só cria) e os badges do Google
// Agenda.

import { useEffect, useRef, useState } from 'react'
import type { Activity } from '../hooks/useActivities'
import {
  CalendarClockIcon, CalendarPlusIcon, CheckCircleIcon, CheckSquareIcon, ChevronRightIcon,
  ClockIcon, MailIcon, MapPinIcon, MessageCircleIcon, MoreVerticalIcon, PhoneCallIcon,
  RotateCcwIcon, SendIcon, TrashIcon, UsersIcon, XCircleIcon,
} from './Icons'

// ── Tipos / resultados (src/types/activities.ts do dashboard) ────────────

const TYPE_CONFIG: Record<string, { label: string; icon: typeof CheckSquareIcon; tone: string }> = {
  task: { label: 'Tarefa', icon: CheckSquareIcon, tone: 'blue' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircleIcon, tone: 'green' },
  call: { label: 'Ligação', icon: PhoneCallIcon, tone: 'orange' },
  email: { label: 'E-mail', icon: MailIcon, tone: 'purple' },
  meeting: { label: 'Reunião', icon: UsersIcon, tone: 'pink' },
  visit: { label: 'Visita', icon: MapPinIcon, tone: 'teal' },
}

const RESULT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  task: [{ value: 'feita', label: 'Feita' }],
  whatsapp: [{ value: 'enviada', label: 'Enviada' }, { value: 'falhou', label: 'Falhou' }],
  email: [{ value: 'enviada', label: 'Enviada' }, { value: 'falhou', label: 'Falhou' }],
  call: [
    { value: 'conectada', label: 'Conectada' },
    { value: 'sem_resposta', label: 'Sem resposta' },
    { value: 'ocupado', label: 'Ocupado' },
    { value: 'caixa_postal', label: 'Caixa postal' },
  ],
  meeting: [
    { value: 'realizada', label: 'Realizada' },
    { value: 'nao_compareceu', label: 'Não compareceu' },
    { value: 'reagendada', label: 'Reagendada' },
  ],
  visit: [
    { value: 'realizada', label: 'Realizada' },
    { value: 'nao_compareceu', label: 'Não compareceu' },
    { value: 'reagendada', label: 'Reagendada' },
  ],
}

const RESULT_TONE: Record<string, string> = {
  feita: 'green', realizada: 'green', conectada: 'green', enviada: 'green',
  respondida: 'blue',
  nao_compareceu: 'red', sem_resposta: 'red', falhou: 'red',
  ocupado: 'amber', caixa_postal: 'amber',
  reagendada: 'yellow',
}

const needsManualResult = (type: string) => type === 'call' || type === 'meeting' || type === 'visit'
const isAutoComplete = (type: string) => type === 'whatsapp' || type === 'email'
const isDone = (status: string) => ['concluida', 'cancelada', 'respondida', 'falhou', 'paused'].includes(status)

/** getStatusDisplay() de ActivityActions.tsx */
function getStatusDisplay(a: Activity): { label: string; tone: string } | null {
  const meta = (a.metadata ?? {}) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  if (a.status === 'concluida' && a.result) {
    const label = RESULT_OPTIONS[a.type]?.find(r => r.value === a.result)?.label ?? a.result
    return { label, tone: RESULT_TONE[a.result] ?? 'green' }
  }
  if (a.status === 'concluida') return { label: 'Concluída', tone: 'green' }
  if (a.status === 'cancelada') {
    if (meta.cancel_reason === 'paused_before_send') return { label: 'Cancelada (resposta)', tone: 'amber' }
    return { label: 'Cancelada', tone: 'neutral' }
  }
  if (a.status === 'paused') return { label: 'Pausada', tone: 'amber' }
  if (a.status === 'enviada') return { label: 'Enviada', tone: 'blue' }
  if (a.status === 'entregue') return { label: 'Entregue', tone: 'green' }
  if (a.status === 'lida') return { label: 'Lida', tone: 'violet' }
  if (a.status === 'respondida') return { label: 'Respondida', tone: 'blue' }
  if (a.status === 'falhou') return { label: 'Falhou', tone: 'red' }
  if (a.status === 'agendada') {
    const confirmation = meta.confirmation?.status ?? null
    if (confirmation === 'confirmed') return { label: 'Confirmada', tone: 'green' }
    if (confirmation === 'sent') return { label: 'Conf. enviada', tone: 'violet' }
    if (confirmation === 'not_confirmed') return { label: 'Não confirmou', tone: 'red' }
    if (a.type === 'task') return null
    return { label: 'Agendada', tone: 'indigo' }
  }
  return null
}

// ── Datas ────────────────────────────────────────────────────────────────

function formatActivityDate(dueDate: string, dueTime: string | null) {
  const d = new Date(`${dueDate.substring(0, 10)}T00:00:00`)
  const formatted = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  return dueTime ? `${formatted} ${dueTime.substring(0, 5)}` : formatted
}

function getCountdown(dueDate: string | null, dueTime: string | null): string | null {
  if (!dueDate) return null
  const target = new Date(`${dueDate.substring(0, 10)}T${dueTime ? dueTime.substring(0, 5) : '23:59'}:00`)
  if (isNaN(target.getTime())) return null
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return null
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `em ${mins}min`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 24) return `em ${hours}h${remMins > 0 ? ` ${remMins}min` : ''}`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  if (days === 1) return remHours > 0 ? `em 1 dia e ${remHours}h` : 'em 1 dia'
  return remHours > 0 ? `em ${days} dias e ${remHours}h` : `em ${days} dias`
}

function isOverdue(a: Activity) {
  if (!a.due_date || a.status !== 'agendada') return false
  const due = new Date(`${a.due_date.substring(0, 10)}T${a.due_time ? a.due_time.substring(0, 5) : '23:59'}:00`)
  return due < new Date()
}

/** getPostponeOptions() do dashboard — mesmas opções e regras de horário. */
function getPostponeOptions(currentDueTime: string | null) {
  const now = new Date()
  const todayStr = now.toISOString().substring(0, 10)
  const currentH = now.getHours()
  const currentTime = currentDueTime?.substring(0, 5) ?? null
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().substring(0, 10)
  const nextMonday = new Date(now)
  const dow = nextMonday.getDay()
  nextMonday.setDate(nextMonday.getDate() + (dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow))
  const nextMondayStr = nextMonday.toISOString().substring(0, 10)
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  const options: { label: string; date: string; time: string | null }[] = []
  if (currentH < 22) {
    const t = new Date(now); t.setHours(t.getHours() + 1)
    options.push({ label: `+1 hora (${hhmm(t)})`, date: todayStr, time: hhmm(t) })
  }
  if (currentH < 20) {
    const t = new Date(now); t.setHours(t.getHours() + 3)
    options.push({ label: `+3 horas (${hhmm(t)})`, date: todayStr, time: hhmm(t) })
  }
  if (currentTime && currentTime !== '09:00' && currentTime !== '14:00') {
    options.push({ label: `Amanhã ${currentTime}`, date: tomorrowStr, time: currentTime })
  }
  options.push({ label: 'Amanhã 09:00', date: tomorrowStr, time: '09:00' })
  options.push({ label: 'Amanhã 14:00', date: tomorrowStr, time: '14:00' })
  options.push({ label: 'Próx. segunda 09:00', date: nextMondayStr, time: '09:00' })
  return options
}

// ── Componente ───────────────────────────────────────────────────────────

export type ActivityAction = 'complete' | 'cancel' | 'reactivate' | 'send_now'

interface Props {
  activity: Activity
  onAction: (id: string, action: ActivityAction, result?: string) => Promise<void>
  onPostpone?: (id: string, date: string, time: string | null) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function ActivityCard({ activity, onAction, onPostpone, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [postponeOpen, setPostponeOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showResultPicker, setShowResultPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const done = isDone(activity.status)
  const overdue = isOverdue(activity)
  const typeConf = TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.task
  const TypeIcon = typeConf.icon
  const statusDisplay = getStatusDisplay(activity)
  const countdown = !done && activity.status === 'agendada' && isAutoComplete(activity.type)
    ? getCountdown(activity.due_date, activity.due_time) : null
  const resultOptions = RESULT_OPTIONS[activity.type] ?? []
  const hasMultipleResults = resultOptions.length > 1

  const meta = (activity.metadata ?? {}) as Record<string, unknown>
  const waPreview = activity.type === 'whatsapp'
    ? (meta.content as string | undefined) || (meta.template_name ? `Template: ${meta.template_name as string}` : null)
    : null

  useEffect(() => {
    if (!menuOpen) return
    const close = () => { setMenuOpen(false); setPostponeOpen(false); setConfirmDelete(false); setShowResultPicker(false) }
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function run(fn: () => Promise<void>) {
    setMenuOpen(false)
    setPostponeOpen(false)
    setConfirmDelete(false)
    setShowResultPicker(false)
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  // getStatusActions() do dashboard: WhatsApp/E-mail só cancelam (o sistema
  // conclui sozinho); ligação/reunião/visita pedem resultado; tarefa conclui direto.
  const canComplete = activity.status === 'agendada' && !isAutoComplete(activity.type)
  const canCancel = activity.status === 'agendada'
  const completeLabel = needsManualResult(activity.type) ? 'Registrar resultado' : 'Completar'

  return (
    <div className={`activity-card${overdue ? ' is-overdue' : ''}${busy ? ' is-busy' : ''}`}>
      <div className="activity-card-l1">
        <TypeIcon size={13} className={`activity-card-icon tone-${typeConf.tone}`} />
        <p className={`activity-card-title${done ? ' is-done' : ''}`} title={activity.title ?? undefined}>
          {activity.title || typeConf.label}
        </p>

        {!done && (
          <div className="activity-card-menu" ref={menuRef}>
            <button type="button" className="activity-card-icon-btn" aria-label="Ações da atividade"
              aria-expanded={menuOpen} disabled={busy} onClick={() => setMenuOpen(v => !v)}>
              <MoreVerticalIcon size={12} />
            </button>
            {menuOpen && (
              <div className="header-menu-dropdown activity-card-dropdown" role="menu">
                {activity.type === 'whatsapp' && activity.status === 'agendada' && (
                  <button type="button" className="tone-green" onClick={() => run(() => onAction(activity.id, 'send_now'))}>
                    <SendIcon size={13} /> Enviar agora
                  </button>
                )}

                {canComplete && (hasMultipleResults ? (
                  !showResultPicker ? (
                    <button type="button" className="tone-green" onClick={() => setShowResultPicker(true)}>
                      <CheckCircleIcon size={13} /> {completeLabel}
                    </button>
                  ) : (
                    <div className="activity-card-results">
                      <div className="activity-card-menu-heading">Resultado</div>
                      {resultOptions.map(opt => (
                        <button key={opt.value} type="button" className="tone-green"
                          onClick={() => run(() => onAction(activity.id, 'complete', opt.value))}>
                          <CheckCircleIcon size={13} /> {opt.label}
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  <button type="button" className="tone-green"
                    onClick={() => run(() => onAction(activity.id, 'complete', resultOptions[0]?.value ?? 'feita'))}>
                    <CheckCircleIcon size={13} /> {completeLabel}
                  </button>
                ))}

                {canCancel && (
                  <button type="button" className="tone-amber" onClick={() => run(() => onAction(activity.id, 'cancel'))}>
                    <XCircleIcon size={13} /> Cancelar
                  </button>
                )}

                {activity.due_date && onPostpone && (
                  <>
                    <div className="header-menu-separator" />
                    <button type="button" onClick={() => setPostponeOpen(v => !v)}>
                      <CalendarPlusIcon size={13} /> Adiar
                      <ChevronRightIcon size={10} className="activity-card-chevron" />
                    </button>
                    {postponeOpen && (
                      <div className="activity-card-postpone">
                        {getPostponeOptions(activity.due_time).map(opt => (
                          <button key={opt.label} type="button"
                            onClick={() => run(() => onPostpone(activity.id, opt.date, opt.time))}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {onDelete && (
                  <>
                    <div className="header-menu-separator" />
                    <button type="button" className="tone-red"
                      onClick={() => (confirmDelete ? run(() => onDelete(activity.id)) : setConfirmDelete(true))}>
                      <TrashIcon size={13} /> {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reativar — só concluídas/canceladas/pausadas (não enviadas/lidas) */}
        {done && (
          <button type="button" className="activity-card-icon-btn activity-card-reactivate" title="Reativar"
            aria-label="Reativar atividade" disabled={busy} onClick={() => run(() => onAction(activity.id, 'reactivate'))}>
            <RotateCcwIcon size={12} />
          </button>
        )}
      </div>

      <div className="activity-card-l2">
        {statusDisplay && <span className={`activity-chip tone-${statusDisplay.tone}`}>{statusDisplay.label}</span>}
        {activity.due_date && (
          <span className={`activity-card-date${overdue ? ' is-overdue' : ''}`}>
            <CalendarClockIcon size={8} />
            {formatActivityDate(activity.due_date, activity.due_time)}
          </span>
        )}
        {countdown && (
          <span className="activity-chip activity-countdown tone-green">
            <ClockIcon size={7} /> Dispara {countdown}
          </span>
        )}
        {done && activity.result && activity.status !== 'concluida' && (
          <span className={`activity-chip tone-${RESULT_TONE[activity.result] ?? 'neutral'}`}>
            {RESULT_OPTIONS[activity.type]?.find(r => r.value === activity.result)?.label ?? activity.result}
          </span>
        )}
        {waPreview && (
          <span className="activity-card-preview" title={waPreview}>
            {waPreview.length > 40 ? `${waPreview.slice(0, 40)}…` : waPreview}
          </span>
        )}
      </div>
    </div>
  )
}
