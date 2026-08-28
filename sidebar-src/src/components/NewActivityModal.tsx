// NewActivityModal.tsx
// Modal "Nova Atividade" — espelha ActivityModal.tsx (app.voeops.com,
// 2239 linhas) na parte relevante pro caso de uso da extensão: os 6 blocos
// de tipo, Título/Descrição, Oportunidade/Contato (aqui sempre os do
// contexto ativo — não pede pra escolher de novo), Responsável, os atalhos
// de "Quando" e o rodapé Cancelar/Criar atividade.
//
// Decisões de escopo (ver resumo enviado ao Bruno):
// - "Ligação" e "E-mail" ficam desabilitados/"Em breve", igual ao real —
//   nem a própria VOE os tem disponíveis ainda (ACTIVITY_TYPES no código
//   real já marca os dois `disabled: true`).
// - Fim do evento / dia inteiro (reunião/visita) não foi replicado — due_date
//   + due_time já bastam pra criar a atividade; esses campos ficam null.
// - "Personalizar" abre inputs nativos de data/hora simples, não o
//   calendário completo do real (autorizado explicitamente).
//
// "WhatsApp" (pedido explícito, rodada posterior — antes ficava desabilitado
// com "No dashboard", igual à VOE de verdade só que ela TEM o subsistema e
// a extensão não tinha): agora usa o MESMO fluxo/estrutura da VOE — criar
// uma atividade WhatsApp é abrir Nova Atividade → tipo WhatsApp, igual lá.
// Quando esse tipo é selecionado, o resto do formulário genérico (Título,
// Descrição, Responsável, Quando) é TROCADO inteiro por
// ScheduleMessagePanel.tsx — que já tem seu próprio formulário completo
// (canal, mensagem/mídia/modelo, calendário, pausar-se-responder, submit).
// Por isso não pode ficar dentro do <form> genérico (form dentro de form é
// inválido) — o formulário genérico só existe pros outros tipos agora.
// Consolidação: "Modelos de mensagens"/"Agendar mensagem" não existem mais
// como botões avulsos no cabeçalho do lead — só chegam aqui.

import { useEffect, useState } from 'react'
import { voeApi } from '../lib/apiClient'
import { supabase } from '../lib/supabaseClient'
import { useWorkspaceUsers } from '../hooks/useWorkspaceUsers'
import { buildActivityDatePresets, formatRelativeLabel } from '../lib/activityDatePresets'
import { ScheduleMessagePanel } from './ScheduleMessagePanel'
import {
  XIcon, CheckSquareIcon, MessageCircleIcon, PhoneCallIcon, MailIcon,
  UsersIcon, MapPinIcon, CalendarIcon,
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
  meeting: 'Reunião com cliente',
  visit: 'Visita ao espaço',
}

function needsManualResult(type: ActivityType) {
  return type === 'call' || type === 'meeting' || type === 'visit'
}

interface Props {
  opportunityId: string
  opportunityName: string
  contactId: string | null
  contactName: string | null
  onClose: () => void
  onCreated: () => void
}

export function NewActivityModal({ opportunityId, opportunityName, contactId, contactName, onClose, onCreated }: Props) {
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

  const { users } = useWorkspaceUsers()

  // Responsável — pré-preenchido com o usuário logado, igual ao real
  // (assignedTo inicia como profile.id; só Admin/Owner reatribuem lá).
  // A extensão não sabe o cargo do usuário no workspace, então o dropdown
  // fica sempre editável — ver ressalva no resumo.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id
      if (uid) setAssignedTo(uid)
    })
  }, [])

  // Bug corrigido: a busca da sessão (acima) e a de useWorkspaceUsers são
  // duas chamadas assíncronas independentes, sem ordem garantida — o
  // <select> abaixo ficava sem nenhuma <option> (ou com o usuário logado
  // selecionado mas fora da lista, ex: super admin, que
  // /api/v1/workspace-users filtra de propósito) até a lista carregar,
  // aparecendo vazio/"quebrado". Assim que `users` chega, confirma que o
  // ID atual é um usuário de verdade da lista; senão cai pro primeiro.
  useEffect(() => {
    if (users.length === 0) return
    setAssignedTo(current => (current && users.some(u => u.id === current) ? current : users[0].id))
  }, [users])

  const presets = buildActivityDatePresets(needsManualResult(type))
  const relativeLabel = formatRelativeLabel(dueDate, dueTime)

  function applyPreset(getDateTime: () => { date: string; time: string }) {
    const { date, time } = getDateTime()
    setDueDate(date)
    setDueTime(time)
    setDateError(false)
    setPastDateError(false)
    setShowCustom(false)
  }

  const canSubmit = !saving && !!title.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (!dueDate) {
      setDateError(true)
      return
    }
    // Mesmo bloqueio de data no passado do real, só pra "task" aqui
    // (meeting/visit permitem passado, igual ao real).
    if (type === 'task') {
      const selected = new Date(`${dueDate}T${dueTime || '23:59'}:00`)
      if (selected < new Date()) {
        setPastDateError(true)
        return
      }
    }

    setDateError(false)
    setPastDateError(false)
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
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar atividade')
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

        {/* Seletor de tipo — fora do <form>, os dois ramos abaixo (genérico
            vs. WhatsApp) têm seu próprio <form> cada um. */}
        <div className="activity-modal-type-picker">
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

        {type === 'whatsapp' ? (
          contactId ? (
            <div className="activity-modal-body">
              <ScheduleMessagePanel
                contactId={contactId}
                opportunityId={opportunityId}
                onScheduled={() => { onCreated(); onClose() }}
              />
            </div>
          ) : (
            <div className="activity-modal-body">
              <p className="muted">Vincule um contato a esse chat para agendar mensagens.</p>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="activity-modal-body">
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
                  <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); setDateError(false); setPastDateError(false) }} />
                  <input type="time" value={dueTime} onChange={e => { setDueTime(e.target.value); setDateError(false); setPastDateError(false) }} />
                </div>
              )}

              {dueDate && relativeLabel && (
                <p className={`activity-relative-label${relativeLabel.includes('atrasada') ? ' is-late' : ''}`}>
                  {relativeLabel}
                </p>
              )}
              {dateError && !dueDate && <p className="error-text">Selecione uma data para a atividade</p>}
              {pastDateError && <p className="error-text">Não é possível criar tarefa com data no passado</p>}
            </div>

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
        )}
      </div>
    </div>
  )
}
