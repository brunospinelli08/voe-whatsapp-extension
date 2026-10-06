// WhatsAppTrackBuilder.tsx
// Trilha de WhatsApp — réplica de components/activities/WhatsAppTrackBuilder.tsx
// do dashboard. Aplica uma trilha PRONTA (criada em Configurações → Conversas →
// Trilha de WhatsApp) na oportunidade: escolhe canal + trilha e cria de uma vez
// a sequência de atividades WhatsApp agendadas, uma por passo. Montar os
// passos da trilha não acontece aqui (fonte de verdade única em Configurações);
// sem trilha nenhuma, convida a ir criar lá.
//
// Texto, dia (D+X) e horário de cada passo dão pra ajustar na hora — override
// local, só nas atividades desta oportunidade; a trilha salva não muda.
//
// Também oferece, na frente, a trilha "detectada na Central de Mensagens":
// mensagens com nome no padrão "Follow N (D+X)" viram uma sequência sugerida
// (comportamento que o dashboard mantém pra quem não migrou pra trilha formal).
//
// Não é motor novo: cada passo vira uma atividade normal (type="whatsapp",
// status="agendada", metadata.pause_on_reply = true) via POST /api/v1/tasks —
// o scheduler/wa-send.worker do backend envia, e se o contato responder os
// passos seguintes são pausados sozinhos.

import { useEffect, useMemo, useRef, useState } from 'react'
import { voeApi, ApiError } from '../lib/apiClient'
import { VOE_API_BASE } from '../config'
import { extractStoragePathFromUrl } from '../lib/mediaStorage'
import { toShortVariableSyntax, type VariableContext } from '../lib/messageVariables'
import { useChannels } from '../hooks/useChannels'
import { useMessageLibrary, type MessageLibraryItem } from '../hooks/useMessageLibrary'
import {
  useWhatsAppTracks, trackStepDate, toDateKey, type WhatsAppTrack, type WhatsAppTrackStep,
} from '../hooks/useWhatsAppTracks'
import { VariablePickerButton, VariableText, VariableTextarea } from './MessageVariables'
import { Spinner } from './Spinner'
import {
  AlertIcon, CalendarClockIcon, CheckIcon, ExternalLinkIcon, GitBranchIcon, MessageCircleIcon,
  PaperclipIcon, PenLineIcon, RefreshIcon, SmartphoneIcon, SparklesIcon, WifiIcon, WifiOffIcon,
} from './Icons'

const MEDIA_LABELS: Record<string, string> = { image: 'Imagem', video: 'Vídeo', audio: 'Áudio', document: 'Documento' }
const SUGGESTED_ID = 'suggested'

/** "Follow 2 (D+5) — Entrega do guia" → 5 */
function parseDayOffset(title: string) {
  const m = title.match(/D\s*\+\s*(\d+)/i)
  return m ? Number(m[1]) : undefined
}

/** "Follow 2 (D+5) — Entrega do guia" → 2 (ordem quando dois passos caem no mesmo dia) */
function parseFollowIndex(title: string) {
  const m = title.match(/Follow\s*(\d+)/i)
  return m ? Number(m[1]) : undefined
}

/** Rótulo da data real do passo. Em dias úteis mostra a data ("seg, 06/10") — "Em 3 dias" confundiria. */
function stepDayLabel(days: number, businessDaysOnly: boolean) {
  const date = trackStepDate(days, businessDaysOnly)
  const today = new Date()
  const calendarDays = Math.round((date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000)
  if (calendarDays === 0) return 'Hoje'
  if (calendarDays === 1) return 'Amanhã'
  if (!businessDaysOnly) return `Em ${calendarDays} dias`
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return `${weekday}, ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

/** Item da Central que é arquivo → campos de metadata pra enviar (o texto vira legenda). */
function libraryMediaMetadata(item: MessageLibraryItem): Record<string, unknown> | null {
  if (!item.file_url || !MEDIA_LABELS[item.content_type]) return null
  const parsed = extractStoragePathFromUrl(item.file_url)
  return {
    send_type: 'media',
    media_type: item.content_type,
    ...(parsed ? { media_storage_path: parsed.path, media_bucket: parsed.bucket } : { media_url: item.file_url }),
    ...(item.file_name ? { file_name: item.file_name } : {}),
  }
}

function withoutKey<T>(obj: Record<string, T>, key: string) {
  const next = { ...obj }
  delete next[key]
  return next
}

interface Props {
  opportunityId: string
  contactId: string | null
  variableContext: VariableContext | null
  onCancel: () => void
  onCreated: () => void
}

export function WhatsAppTrackBuilder({ opportunityId, contactId, variableContext, onCancel, onCreated }: Props) {
  const { channels: allChannels, loading: loadingChannels } = useChannels()
  const { tracks: savedTracks, loading: tracksLoading, error: tracksError, refetch } = useWhatsAppTracks(true)
  const { messages: libraryMessages } = useMessageLibrary()

  // Texto livre só funciona em canal Evolution Go (API Voe) — a API Oficial
  // exige template aprovado fora da janela de 24h.
  const channels = useMemo(() => allChannels.filter(c => c.provider === 'evolution_go'), [allChannels])
  const [channelId, setChannelId] = useState('')
  useEffect(() => { if (channels.length === 1) setChannelId(channels[0].id) }, [channels])

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [messageOverrides, setMessageOverrides] = useState<Record<string, string>>({})
  const [dayOffsetOverrides, setDayOffsetOverrides] = useState<Record<string, number>>({})
  const [timeOverrides, setTimeOverrides] = useState<Record<string, string>>({})
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const editingTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Trocar de trilha descarta as edições da anterior.
  useEffect(() => {
    setMessageOverrides({})
    setDayOffsetOverrides({})
    setTimeOverrides({})
    setEditingStepId(null)
  }, [selectedTrackId])

  // Sequência "Follow N (D+X)" já salva na Central de Mensagens, oferecida
  // como mais uma trilha (id sintético — não existe no banco).
  const suggested = useMemo<WhatsAppTrack | null>(() => {
    const matches = libraryMessages
      .map(m => ({ m, offset: parseDayOffset(m.title), idx: parseFollowIndex(m.title) }))
      .filter((x): x is { m: MessageLibraryItem; offset: number; idx: number } => x.offset !== undefined && x.idx !== undefined)
      .sort((a, b) => a.idx - b.idx)
    if (matches.length < 2) return null
    return {
      id: SUGGESTED_ID,
      name: 'Trilha detectada na Central de Mensagens',
      description: 'Sequência "Follow N (D+X)" encontrada automaticamente pelo nome das mensagens.',
      business_days_only: true,
      whatsapp_track_steps: matches.map(({ m, offset }, i) => ({
        id: `suggested-${m.id}`, position: i + 1, day_offset: offset, time: '09:00',
        title: m.title, message: m.content, message_library_id: m.id,
      })),
    }
  }, [libraryMessages])

  const allTracks = useMemo(() => (suggested ? [suggested, ...savedTracks] : savedTracks), [suggested, savedTracks])
  const selectedTrack = allTracks.find(t => t.id === selectedTrackId) ?? null
  // Trilhas antigas (sem a coluna) contam como dias úteis — é o padrão.
  const businessDaysOnly = selectedTrack?.business_days_only !== false
  const selectedSteps = useMemo(
    () => (selectedTrack
      ? [...selectedTrack.whatsapp_track_steps]
        .sort((a, b) => a.day_offset - b.day_offset)
        .map(s => ({ ...s, message: toShortVariableSyntax(s.message) }))
      : []),
    [selectedTrack],
  )
  const libraryById = useMemo(() => new Map(libraryMessages.map(m => [m.id, m])), [libraryMessages])
  const stepFile = (s: WhatsAppTrackStep) => {
    const item = s.message_library_id ? libraryById.get(s.message_library_id) : undefined
    return item && item.file_url && MEDIA_LABELS[item.content_type] ? item : undefined
  }

  function insertVariable(stepId: string, currentValue: string, token: string) {
    const ta = editingTextareaRef.current
    if (!ta) { setMessageOverrides(prev => ({ ...prev, [stepId]: currentValue + token })); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    setMessageOverrides(prev => ({ ...prev, [stepId]: currentValue.substring(0, start) + token + currentValue.substring(end) }))
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + token.length, start + token.length) })
  }

  async function handleSubmit() {
    setError(null)
    if (!contactId) return setError('Esta oportunidade não tem um contato vinculado — vincule um contato antes de criar a trilha.')
    if (!channelId) return setError('Selecione o canal de WhatsApp que vai enviar as mensagens.')
    if (!selectedTrack) return setError('Escolha uma trilha pra aplicar.')

    setSaving(true)
    setProgress(0)
    try {
      for (const [i, s] of selectedSteps.entries()) {
        const file = stepFile(s)
        const dayOffset = dayOffsetOverrides[s.id] ?? s.day_offset
        const time = timeOverrides[s.id] ?? (s.time?.slice(0, 5) || '09:00')
        const dueDate = toDateKey(trackStepDate(dayOffset, businessDaysOnly))
        await voeApi.post('/api/v1/tasks', {
          type: 'whatsapp',
          title: s.title,
          status: 'agendada',
          result: null,
          contact_id: contactId,
          opportunity_id: opportunityId,
          due_date: dueDate,
          due_time: time,
          scheduled_at: new Date(`${dueDate}T${time}:00`).toISOString(),
          // track_id/track_step_id: o que a automação "Cancelar agendamentos de
          // WhatsApp" usa pra saber o que cancelar (a sugerida não existe no banco).
          metadata: {
            channel_id: channelId, send_type: 'message',
            ...(file ? libraryMediaMetadata(file) : {}),
            content: messageOverrides[s.id] ?? s.message, pause_on_reply: true,
            source: 'manual',
            ...(selectedTrack.id !== SUGGESTED_ID ? { track_id: selectedTrack.id, track_step_id: s.id } : {}),
          },
        }).catch(err => {
          const reason = err instanceof ApiError && err.status === 403
            ? 'Agendamento de WhatsApp não disponível no seu plano atual.'
            : err instanceof Error ? err.message : 'erro desconhecido'
          throw new Error(i > 0
            ? `Falha ao criar o passo "${s.title}" (${reason}). ${i} de ${selectedSteps.length} já foram criados — confira na aba Atividades antes de tentar de novo.`
            : `Falha ao criar o passo "${s.title}": ${reason}`)
        })
        setProgress(i + 1)
      }
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar a trilha')
    } finally {
      setSaving(false)
    }
  }

  const missing = !channelId ? 'Selecione um canal' : !selectedTrack ? 'Escolha uma trilha' : null

  return (
    <div className="activity-modal-body track-builder">
      <p className="track-intro">
        Aplica uma trilha pronta (mensagens e intervalos já definidos em Configurações) na oportunidade —
        cria a sequência de atividades agendadas de uma vez. Se o contato responder, os passos seguintes
        são pausados sozinhos.
      </p>

      {/* ── 1. Canal ── */}
      <SectionHeading n={1} icon={SmartphoneIcon} title="Canal de WhatsApp" />
      {loadingChannels ? <Spinner label="Carregando canais…" /> : channels.length === 0 ? (
        <div className="wa-alert">
          <AlertIcon size={13} /> Nenhum canal Evolution Go (API Voe) ativo neste workspace — a trilha precisa de um pra mandar texto livre.
        </div>
      ) : channels.length === 1 ? (
        <div className="track-single-channel">
          <span className="track-channel-icon"><SmartphoneIcon size={15} /></span>
          <span className="wa-channel-info">
            <span className="wa-channel-name">{channels[0].display_name}</span>
            {channels[0].phone_number && <span className="wa-channel-sub">{channels[0].phone_number}</span>}
          </span>
          <ConnectionLabel connected={channels[0].connection_status === 'connected'} />
        </div>
      ) : (
        <div className="wa-channel-grid">
          {channels.map(c => (
            <button key={c.id} type="button" className={`wa-channel-card track-channel-card${c.id === channelId ? ' is-selected' : ''}`} onClick={() => setChannelId(c.id)}>
              {c.connection_status === 'connected' ? <WifiIcon size={14} className="wa-wifi-on" /> : <WifiOffIcon size={14} className="wa-wifi-off" />}
              <span className="wa-channel-info">
                <span className="wa-channel-name">{c.display_name}</span>
                {c.phone_number && <span className="wa-channel-sub">{c.phone_number}</span>}
              </span>
              {c.id === channelId && <CheckIcon size={14} className="track-check-inline" />}
            </button>
          ))}
        </div>
      )}

      {/* ── 2. Trilha ── */}
      <div className="track-heading-row">
        <SectionHeading n={2} icon={GitBranchIcon} title="Trilha" />
        {!tracksLoading && allTracks.length > 0 && (
          <button type="button" className="track-refresh" onClick={refetch} title="Atualizar lista de trilhas">
            <RefreshIcon size={11} /> Atualizar
          </button>
        )}
      </div>

      {tracksLoading ? <Spinner label="Carregando trilhas…" /> : tracksError ? (
        <div className="wa-alert"><AlertIcon size={13} /> {tracksError}</div>
      ) : allTracks.length === 0 ? (
        <EmptyTracksState onRefresh={refetch} />
      ) : (
        <div className="track-cards">
          {allTracks.map(track => (
            <TrackCard key={track.id} track={track} auto={track.id === SUGGESTED_ID}
              selected={track.id === selectedTrackId} onSelect={() => setSelectedTrackId(track.id)} />
          ))}
        </div>
      )}

      {/* ── Prévia da sequência escolhida ── */}
      {selectedTrack && selectedSteps.length > 0 && (
        <div>
          <p className="track-preview-title">
            Prévia — o que vai ser criado
            {businessDaysOnly && <span> · contando só dias úteis (sem sábado e domingo)</span>}
          </p>
          <div className={`track-timeline${selectedSteps.length > 1 ? ' has-line' : ''}`}>
            {selectedSteps.map((step, idx) => {
              const isEditing = editingStepId === step.id
              const originalTime = step.time?.slice(0, 5) || '09:00'
              const displayMessage = messageOverrides[step.id] ?? step.message
              const displayDayOffset = dayOffsetOverrides[step.id] ?? step.day_offset
              const displayTime = timeOverrides[step.id] ?? originalTime
              const isEdited =
                (messageOverrides[step.id] !== undefined && messageOverrides[step.id] !== step.message) ||
                (dayOffsetOverrides[step.id] !== undefined && dayOffsetOverrides[step.id] !== step.day_offset) ||
                (timeOverrides[step.id] !== undefined && timeOverrides[step.id] !== originalTime)
              const file = stepFile(step)
              return (
                <div key={step.id} className="track-step">
                  <span className="track-step-number">{idx + 1}</span>
                  <div className="track-step-card">
                    <div className="track-step-head">
                      {isEditing ? (
                        <span className="track-step-when-edit">
                          <span className="track-day-stepper">
                            <CalendarClockIcon size={11} />
                            <span className="track-stepper-box">
                              <button type="button" aria-label="Diminuir dia" disabled={displayDayOffset <= 0}
                                onClick={() => setDayOffsetOverrides(prev => ({ ...prev, [step.id]: Math.max(0, displayDayOffset - 1) }))}>−</button>
                              <span>{displayDayOffset}</span>
                              <button type="button" aria-label="Aumentar dia"
                                onClick={() => setDayOffsetOverrides(prev => ({ ...prev, [step.id]: displayDayOffset + 1 }))}>+</button>
                            </span>
                            <span className="track-day-unit">
                              dia{displayDayOffset === 1 ? '' : 's'}{businessDaysOnly ? (displayDayOffset === 1 ? ' útil' : ' úteis') : ''}
                            </span>
                          </span>
                          <span className="track-at">às</span>
                          <input type="time" className="track-time-input" value={displayTime}
                            onChange={e => setTimeOverrides(prev => ({ ...prev, [step.id]: e.target.value }))} />
                        </span>
                      ) : (
                        <span className={`track-step-when${isEdited ? ' is-edited' : ''}`}>
                          <CalendarClockIcon size={10} /> {stepDayLabel(displayDayOffset, businessDaysOnly)} · {displayTime}
                        </span>
                      )}
                      <p className="track-step-title">{step.title}</p>
                      {!isEditing && (
                        <button type="button" className="track-step-edit" title="Editar mensagem, dia e horário desta atividade"
                          onClick={() => setEditingStepId(step.id)}>
                          <PenLineIcon size={12} />
                        </button>
                      )}
                    </div>

                    {file && (
                      <span className="track-step-file">
                        <PaperclipIcon size={10} />
                        <strong>{MEDIA_LABELS[file.content_type]}</strong>
                        {file.file_name && <span title={file.file_name}>· {file.file_name}</span>}
                      </span>
                    )}

                    {isEditing ? (
                      <div className="track-step-editor">
                        <div className="track-step-editor-tools">
                          <VariablePickerButton onInsert={token => insertVariable(step.id, displayMessage, token)} />
                        </div>
                        <VariableTextarea ref={editingTextareaRef} value={displayMessage} variableContext={variableContext} rows={3}
                          onValueChange={v => setMessageOverrides(prev => ({ ...prev, [step.id]: v }))} />
                        <div className="track-step-editor-foot">
                          <p>Vale só pra esta atividade — a trilha em Configurações não muda.</p>
                          <button type="button" className="link-button" onClick={() => setEditingStepId(null)}>Pronto</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="track-step-message"><VariableText text={displayMessage} context={variableContext} /></p>
                        {isEdited && (
                          <button type="button" className="track-step-restore" onClick={() => {
                            setMessageOverrides(prev => withoutKey(prev, step.id))
                            setDayOffsetOverrides(prev => withoutKey(prev, step.id))
                            setTimeOverrides(prev => withoutKey(prev, step.id))
                          }}>
                            <RefreshIcon size={9} /> Editado nesta atividade · restaurar original
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && <div className="error-banner"><span>⚠</span><span>{error}</span></div>}

      <div className="track-footer">
        <p>{saving ? `Criando ${progress + 1 > selectedSteps.length ? selectedSteps.length : progress + 1} de ${selectedSteps.length}…` : missing}</p>
        <div className="activity-modal-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="button" onClick={handleSubmit} disabled={saving || !!missing}>
            <MessageCircleIcon size={13} /> Criar trilha ({selectedSteps.length} passo{selectedSteps.length === 1 ? '' : 's'})
          </button>
        </div>
      </div>
    </div>
  )
}

function ConnectionLabel({ connected }: { connected: boolean }) {
  return (
    <span className={`track-connection${connected ? ' is-on' : ''}`}>
      {connected ? <WifiIcon size={13} /> : <WifiOffIcon size={13} />}
      {connected ? 'Conectado' : 'Desconectado'}
    </span>
  )
}

/** Cabeçalho numerado ("1. Canal", "2. Trilha") — mesma hierarquia do dashboard. */
function SectionHeading({ n, icon: Icon, title }: { n: number; icon: typeof SmartphoneIcon; title: string }) {
  return (
    <div className="track-section-heading">
      <span className="track-section-number">{n}</span>
      <Icon size={13} />
      <h4>{title}</h4>
    </div>
  )
}

/** Cartão de trilha: nome, descrição e resumo dos passos (hoje, +2d, +5d). */
function TrackCard({ track, auto, selected, onSelect }: { track: WhatsAppTrack; auto: boolean; selected: boolean; onSelect: () => void }) {
  const steps = [...track.whatsapp_track_steps].sort((a, b) => a.day_offset - b.day_offset)
  const Icon = auto ? SparklesIcon : GitBranchIcon
  return (
    <button type="button" className={`track-card${selected ? ' is-selected' : ''}`} onClick={onSelect}>
      <span className="track-card-icon"><Icon size={15} /></span>
      <span className="track-card-body">
        <span className="track-card-name">
          <strong>{track.name}</strong>
          {auto && <span className="track-card-badge">Sugestão</span>}
        </span>
        {track.description && <span className="track-card-desc">{track.description}</span>}
        <span className="track-card-steps">
          {steps.length} mensage{steps.length === 1 ? 'm' : 'ns'} · {steps.map(s => (s.day_offset === 0 ? 'hoje' : `+${s.day_offset}d`)).join(', ')}
        </span>
      </span>
      {selected && <span className="track-card-check"><CheckIcon size={11} /></span>}
    </button>
  )
}

/** Sem trilha nenhuma: convida a criar em Configurações (nova aba) e atualizar ao voltar. */
function EmptyTracksState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="track-empty">
      <span className="track-empty-icon"><SparklesIcon size={18} /></span>
      <p className="track-empty-title">Nenhuma trilha criada ainda</p>
      <p className="track-empty-text">
        Trilhas são sequências de mensagens (D+0, D+2, D+5...) que você monta uma vez em Configurações
        e reaproveita sempre que quiser.
      </p>
      <div className="track-empty-actions">
        <a className="track-empty-link" href={`${VOE_API_BASE}/settings?nav=conversas&tab=trilha`} target="_blank" rel="noopener noreferrer">
          <ExternalLinkIcon size={12} /> Criar trilha em Configurações
        </a>
        <button type="button" className="secondary track-empty-refresh" onClick={onRefresh} title="Já criei — atualizar lista">
          <RefreshIcon size={12} />
        </button>
      </div>
    </div>
  )
}

