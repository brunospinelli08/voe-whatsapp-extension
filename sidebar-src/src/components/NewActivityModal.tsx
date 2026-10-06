// NewActivityModal.tsx
// Modal "Nova Atividade" — espelha ActivityModal.tsx (app.voeops.com) na
// parte relevante pro caso de uso da extensão: os 6 blocos de tipo,
// Título/Descrição, Oportunidade/Contato (aqui sempre os do contexto ativo —
// não pede pra escolher de novo), Responsável, "Quando" e o rodapé
// Cancelar/Criar atividade.
//
// Decisões de escopo:
// - "Ligação" e "E-mail" ficam desabilitados/"Em breve", igual ao real
//   (ACTIVITY_TYPES lá marca os dois `disabled: true`).
// - Fim do evento / dia inteiro (reunião/visita) não foi replicado — due_date
//   + due_time bastam pra criar a atividade; esses campos ficam null.
// - "Personalizar" (tarefa/reunião/visita) abre inputs nativos de data/hora,
//   não o calendário completo do real.
//
// WhatsApp segue o mesmo fluxo do real: o formulário é o mesmo dos outros
// tipos (Título, Descrição, Responsável), com os cards "Agendar mensagem /
// Trilha de WhatsApp" no topo, o "Quando" com os presets de WhatsApp
// (WhatsAppWhenPicker), a seção "Configuração WhatsApp" e o "Resumo do
// agendamento" (WhatsAppActivitySection.tsx). A Trilha fica "Em breve" até a
// parte 2 (construtor de trilha).

import { useEffect, useState } from 'react'
import { voeApi, ApiError } from '../lib/apiClient'
import { supabase } from '../lib/supabaseClient'
import { useWorkspaceUsers } from '../hooks/useWorkspaceUsers'
import { buildActivityDatePresets, formatRelativeLabel } from '../lib/activityDatePresets'
import type { VariableContext } from '../lib/messageVariables'
import { WhatsAppWhenPicker } from './WhatsAppWhenPicker'
import { WhatsAppConfigSection, WhatsAppScheduleSummary, useWhatsAppActivityForm } from './WhatsAppActivitySection'
import {
  XIcon, CheckSquareIcon, MessageCircleIcon, PhoneCallIcon, MailIcon,
  UsersIcon, MapPinIcon, CalendarIcon, SendIcon, GitBranchIcon, AlertIcon,
} from './Icons'

type ActivityType = 'task' | 'whatsapp' | 'call' | 'email' | 'meeting' | 'visit'

const TYPES: { key: ActivityType; label: string; icon: typeof CheckSquareIcon; disabled?: boolean; hint?: string }[] = [
  { key: 'task', label: 'Tarefa', icon: CheckSquareIcon },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircleIcon },
  { key: 'call', label: 'Ligação', icon: PhoneCallIcon, disabled: true, hint: 'Em breve' },
  { key: 'email', label: 'E-mail', icon: MailIcon, disabled: true, hint: 'Em breve' },
  { key: 'meeting', label: 'Reunião', icon: UsersIcon },
  { key: 'visit', label: 'Visita', icon: MapPinIcon },
]

const TITLE_PLACEHOLDER: Partial<Record<ActivityType, string>> = {
  whatsapp: 'Follow-up WhatsApp',
  meeting: 'Reunião com cliente',
  visit: 'Visita ao espaço',
}

const PAST_DATE_MESSAGE: Partial<Record<ActivityType, string>> = {
  task: 'Não é possível criar tarefa com data no passado',
  whatsapp: 'Não é possível agendar WhatsApp para uma data/hora no passado',
}

function needsManualResult(type: ActivityType) {
  return type === 'call' || type === 'meeting' || type === 'visit'
}

interface Props {
  opportunityId: string
  opportunityName: string
  contactId: string | null
  contactName: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  companyName?: string | null
  onClose: () => void
  onCreated: () => void
}

export function NewActivityModal({
  opportunityId, opportunityName, contactId, contactName, contactPhone = null, contactEmail = null, companyName = null,
  onClose, onCreated,
}: Props) {
  const [type, setType] = useState<ActivityType>('task')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateError, setDateError] = useState(false)
  const [pastDateError, setPastDateError] = useState(false)
  const [contactError, setContactError] = useState(false)

  const { users } = useWorkspaceUsers()
  const isWhatsApp = type === 'whatsapp'

  const wa = useWhatsAppActivityForm({
    enabled: isWhatsApp,
    contactName,
    // Igual ao real: só sobrescreve o título se estiver vazio ou ainda for a
    // sugestão automática anterior (não apaga o que o usuário digitou).
    onSuggestTitle: (next, previous) => setTitle(current => (!current.trim() || current === previous ? next : current)),
  })

  // Com contato, as variáveis das mensagens já aparecem com o dado dele (em verde).
  const variableContext: VariableContext | null = contactId
    ? { contactName, contactPhone, contactEmail, companyName }
    : null

  // Responsável — pré-preenchido com o usuário logado, igual ao real
  // (assignedTo inicia como profile.id; só Admin/Owner reatribuem lá).
  // A extensão não sabe o cargo do usuário no workspace, então o dropdown
  // fica sempre editável.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id
      if (uid) setAssignedTo(uid)
    })
  }, [])

  // A sessão (acima) e useWorkspaceUsers chegam em ordem indefinida: assim
  // que `users` carrega, confirma que o ID atual está na lista (super admin,
  // por ex., é filtrado de /api/v1/workspace-users); senão cai pro primeiro.
  useEffect(() => {
    if (users.length === 0) return
    setAssignedTo(current => (current && users.some(u => u.id === current) ? current : users[0].id))
  }, [users])

  const presets = buildActivityDatePresets(needsManualResult(type))
  const relativeLabel = formatRelativeLabel(dueDate, dueTime)

  function setWhen(date: string, time: string) {
    setDueDate(date)
    setDueTime(time)
    setDateError(false)
    setPastDateError(false)
  }

  function applyPreset(getDateTime: () => { date: string; time: string }) {
    const { date, time } = getDateTime()
    setWhen(date, time)
    setShowCustom(false)
  }

  // Para WhatsApp exige o formulário completo (contato, canal, modelo/mensagem,
  // data e hora); demais tipos mantêm só o título obrigatório.
  const waScheduleValid = !!contactId && !!wa.channelId && wa.messageReady && !!dueDate && !!dueTime
  const canSubmit = !saving && !wa.mediaUploading && !!title.trim() && (!isWhatsApp || waScheduleValid)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    if (isWhatsApp && !waScheduleValid) {
      if (!contactId) setContactError(true)
      else if (!wa.channelId) wa.setChannelError(true)
      else if (!dueDate || !dueTime) setDateError(true)
      return
    }
    if (!dueDate) {
      setDateError(true)
      return
    }
    // Mesmo bloqueio de data no passado do real (task/whatsapp; reunião e
    // visita permitem passado).
    if (type === 'task' || isWhatsApp) {
      const selected = new Date(`${dueDate}T${dueTime || '23:59'}:00`)
      if (selected < new Date()) {
        setPastDateError(true)
        return
      }
    }

    setDateError(false)
    setPastDateError(false)
    setContactError(false)
    setSaving(true)
    setError(null)
    try {
      await voeApi.post('/api/v1/tasks', {
        type,
        title: title.trim(),
        description: description.trim() || null,
        status: 'agendada',
        result: null,
        contact_id: contactId,
        opportunity_id: opportunityId,
        assigned_to: assignedTo || null,
        due_date: dueDate,
        due_time: dueTime || null,
        // WhatsApp dispara por scheduled_at (createActivity do dashboard calcula igual)
        ...(isWhatsApp ? { scheduled_at: new Date(`${dueDate}T${dueTime || '09:00'}:00`).toISOString(), metadata: wa.buildMetadata() } : {}),
      })
      onCreated()
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && isWhatsApp) {
        setError('Agendamento de WhatsApp não disponível no seu plano atual.')
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao criar atividade')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="activity-modal-backdrop" onClick={onClose}>
      <div className="activity-modal" onClick={e => e.stopPropagation()}>
        <div className="activity-modal-header">
          <h3>Nova Atividade</h3>
          <button type="button" className="activity-modal-close" onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="activity-modal-body">
          <div>
            <label className="form-label-standalone">Tipo</label>
            <div className="activity-type-grid">
              {TYPES.map(({ key, label, icon: Icon, disabled, hint }) => (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  title={disabled ? hint : undefined}
                  onClick={() => !disabled && setType(key)}
                  className={`activity-type-btn${type === key ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
                >
                  <Icon size={16} />
                  {label}
                  {disabled && <span className="activity-type-badge">Em breve</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ── Mensagem única vs. Trilha (acima do título) ── */}
          {isWhatsApp && (
            <div className="wa-mode-grid">
              <div className="wa-mode-card is-active">
                <span className="wa-mode-icon is-primary"><SendIcon size={15} /></span>
                <span>
                  <span className="wa-mode-title">Agendar mensagem</span>
                  <span className="wa-mode-sub">Uma mensagem única</span>
                </span>
              </div>
              <button type="button" className="wa-mode-card" disabled title="Em breve na extensão">
                <span className="wa-mode-icon is-green"><GitBranchIcon size={15} /></span>
                <span>
                  <span className="wa-mode-title">Trilha de WhatsApp</span>
                  <span className="wa-mode-sub">Várias mensagens agendadas</span>
                </span>
                <span className="activity-type-badge">Em breve</span>
              </button>
            </div>
          )}

          <label>
            Título *
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder={TITLE_PLACEHOLDER[type] ?? 'Título da atividade'}
              autoFocus
            />
          </label>

          <label>
            Descrição
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalhes opcionais..."
            />
          </label>

          {/* ── Oportunidade / Contato — já vêm do contexto ativo, sem pedir de novo ── */}
          <div className="activity-context-row">
            <div>
              <span className="form-label-standalone">Oportunidade</span>
              <p className="activity-context-value">{opportunityName}</p>
            </div>
            <div>
              <span className="form-label-standalone">Contato</span>
              <p className="activity-context-value">{contactName ?? '—'}</p>
            </div>
          </div>

          {/* ── Responsável ── */}
          <label>
            Responsável
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              disabled={users.length === 0}
            >
              {users.length === 0
                ? <option value="">Carregando…</option>
                : users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </label>

          {/* ── Quando ── */}
          {isWhatsApp ? (
            <WhatsAppWhenPicker date={dueDate} time={dueTime} onChange={setWhen} error={dateError} />
          ) : (
            <div>
              <div className="activity-when-header">
                <label className="form-label-standalone">
                  <CalendarIcon size={12} /> Quando *
                </label>
                {dueDate && !showCustom && (
                  <button type="button" className="link-button" onClick={() => setShowCustom(true)}>
                    Personalizar
                  </button>
                )}
              </div>
              <div className="activity-presets">
                {presets.map(preset => {
                  const { date, time } = preset.getDateTime()
                  const isActive = dueDate === date && dueTime === time
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={`activity-preset-pill${isActive ? ' is-active' : ''}`}
                      onClick={() => applyPreset(preset.getDateTime)}
                    >
                      {preset.label}
                    </button>
                  )
                })}
                {!showCustom && (
                  <button type="button" className="activity-preset-pill" onClick={() => setShowCustom(true)}>
                    Personalizar
                  </button>
                )}
              </div>

              {showCustom && (
                <div className="activity-custom-date">
                  <input type="date" value={dueDate} onChange={e => setWhen(e.target.value, dueTime)} />
                  <input type="time" value={dueTime} onChange={e => setWhen(dueDate, e.target.value)} />
                </div>
              )}

              {dueDate && relativeLabel && (
                <p className={`activity-relative-label${relativeLabel.includes('atrasada') ? ' is-late' : ''}`}>
                  {relativeLabel}
                </p>
              )}
              {dateError && !dueDate && <p className="error-text">Selecione uma data para a atividade</p>}
            </div>
          )}
          {isWhatsApp && dateError && dueDate && !dueTime && <p className="error-text">Selecione o horário do envio</p>}
          {pastDateError && PAST_DATE_MESSAGE[type] && (
            <div className="wa-alert"><AlertIcon size={13} /> {PAST_DATE_MESSAGE[type]}</div>
          )}

          {isWhatsApp && (
            <>
              <WhatsAppConfigSection form={wa} contactError={contactError || !contactId} variableContext={variableContext} />
              <WhatsAppScheduleSummary form={wa} contactName={contactName} contactPhone={contactPhone}
                dueDate={contactId ? dueDate : ''} dueTime={dueTime} />
            </>
          )}

          {error && (
            <div className="error-banner">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className="activity-modal-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" disabled={!canSubmit}>
              {saving ? 'Criando…' : 'Criar atividade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
