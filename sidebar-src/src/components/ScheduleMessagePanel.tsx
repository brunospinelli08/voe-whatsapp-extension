// ScheduleMessagePanel.tsx
// Agendar envio de uma mensagem pro lead ativo — mesma mecânica da aba
// Conversa real (ScheduleDropdown.tsx + handleScheduleTextFromInput/
// handleScheduleFromLibrary em inbox/page.tsx do app.voeops.com): grava
// uma atividade type="whatsapp" na tabela `activities` (via POST
// /api/v1/tasks, endpoint já existente, sem mudança nenhuma pra aceitar
// esse shape). Quem envia de fato é o scheduler.worker + wa-send.worker no
// voe-backend — servidor, roda independente do navegador/extensão estarem
// abertos.
//
// Dois modos, mesmo formulário:
// - Texto livre (sem `libraryItem`) — usado direto do cabeçalho do painel.
// - Mídia da biblioteca (`libraryItem` com content_type !== 'text') — a
//   mídia em si não é editável (vem do modelo salvo), só a legenda.
//   Bloqueado em canal Cloud API, igual ao real (`handleScheduleFromLibrary`
//   — agendamento de mídia não é suportado nesse provedor).
//
// `conversation_id` não é enviado no metadata — o wa-send.worker resolve/
// cria a conversa sozinho a partir de channel_id + telefone do contato.

import { useEffect, useState } from 'react'
import { voeApi, ApiError } from '../lib/apiClient'
import { useChannels } from '../hooks/useChannels'
import { buildActivityDatePresets, formatRelativeLabel } from '../lib/activityDatePresets'
import { extractStoragePathFromUrl } from '../lib/mediaStorage'
import type { MessageLibraryItem } from '../hooks/useMessageLibrary'
import { Spinner } from './Spinner'
import { CalendarIcon, ClockIcon } from './Icons'

export const MEDIA_TYPE_LABEL: Record<string, string> = {
  audio: '🎵 Áudio',
  image: '🖼️ Imagem',
  video: '🎬 Vídeo',
  document: '📄 Documento',
}

interface Props {
  contactId: string
  /** Presente ao agendar a partir de um item de mídia da biblioteca. Ausente = texto livre. */
  libraryItem?: MessageLibraryItem
  /**
   * Oportunidade vinculada ao lead ativo (se houver). Sem isso, a atividade
   * agendada não aparece na aba Atividades — que lista por opportunity_id,
   * não por contact_id (achado testando: o wa-send.worker só exige
   * contact_id pra enviar, então a mensagem ainda seria enviada certinha,
   * só ficaria invisível/impossível de cancelar por aqui).
   */
  opportunityId?: string | null
}

export function ScheduleMessagePanel({ contactId, libraryItem, opportunityId }: Props) {
  const { channels, loading: loadingChannels, error: channelsError } = useChannels()
  const isMedia = !!libraryItem && libraryItem.content_type !== 'text'
  const [text, setText] = useState(libraryItem?.content ?? '')
  const [channelId, setChannelId] = useState('')
  const [pauseOnReply, setPauseOnReply] = useState(true)
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [dateError, setDateError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const presets = buildActivityDatePresets(false)
  const relativeLabel = formatRelativeLabel(dueDate, dueTime)

  // Auto-seleciona o único canal (ou o default, se vier mais de um); se
  // sobrar mais de uma opção o <select> abaixo aparece pro usuário escolher.
  useEffect(() => {
    if (channels.length === 0) return
    setChannelId(current => (current && channels.some(c => c.id === current) ? current : channels[0].id))
  }, [channels])

  const selectedChannel = channels.find(c => c.id === channelId)
  const blockedCloudApi = isMedia && selectedChannel?.provider === 'cloud_api'

  function applyPreset(getDateTime: () => { date: string; time: string }) {
    const { date, time } = getDateTime()
    setDueDate(date)
    setDueTime(time)
    setDateError(false)
    setShowCustom(false)
  }

  const canSubmit =
    !saving && !blockedCloudApi && !!channelId && !!dueDate && (isMedia || text.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (blockedCloudApi) return
    const trimmed = text.trim()
    if (!isMedia && !trimmed) return
    if (!dueDate) {
      setDateError(true)
      return
    }

    const scheduledAt = new Date(`${dueDate}T${dueTime || '09:00'}:00`)
    if (scheduledAt.getTime() <= Date.now()) {
      setError('Escolha um horário no futuro.')
      return
    }

    setDateError(false)
    setSaving(true)
    setError(null)
    setDone(false)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata: Record<string, any> = {
        send_type: isMedia ? 'media' : 'message',
        channel_id: channelId,
        pause_on_reply: pauseOnReply,
      }

      let title: string
      if (isMedia && libraryItem) {
        metadata.media_type = libraryItem.content_type
        metadata.file_name = libraryItem.file_name
        metadata.content = trimmed || `[${libraryItem.title}]`
        const parsed = extractStoragePathFromUrl(libraryItem.file_url ?? '')
        if (parsed) {
          metadata.media_storage_path = parsed.path
          metadata.media_bucket = parsed.bucket
        } else {
          metadata.media_url = libraryItem.file_url
        }
        title = `📩 Agendada: ${libraryItem.title.slice(0, 40)}`
      } else {
        metadata.content = trimmed
        title = `📩 Agendada: ${trimmed.slice(0, 40)}${trimmed.length > 40 ? '…' : ''}`
      }

      await voeApi.post('/api/v1/tasks', {
        type: 'whatsapp',
        title,
        status: 'agendada',
        result: null,
        contact_id: contactId,
        opportunity_id: opportunityId ?? null,
        due_date: dueDate,
        due_time: dueTime || null,
        scheduled_at: scheduledAt.toISOString(),
        metadata,
      })
      setDone(true)
      if (!isMedia) setText('')
      setDueDate('')
      setDueTime('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Agendamento de WhatsApp não disponível no seu plano atual.')
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao agendar mensagem')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loadingChannels) return <Spinner label="Carregando canais…" />

  if (channelsError) {
    return (
      <div className="error-banner">
        <span>⚠</span>
        <span>{channelsError}</span>
      </div>
    )
  }

  if (channels.length === 0) {
    return <p className="muted">Nenhum canal de WhatsApp conectado nesse workspace ainda.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="schedule-message-panel">
      {isMedia && libraryItem ? (
        <div className="schedule-media-preview">
          <span className="schedule-media-badge">{MEDIA_TYPE_LABEL[libraryItem.content_type] ?? libraryItem.content_type}</span>
          <strong>{libraryItem.file_name || libraryItem.title}</strong>
        </div>
      ) : null}

      <label>
        {isMedia ? 'Legenda (opcional)' : 'Mensagem'}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={isMedia ? 2 : 3}
          placeholder={isMedia ? 'Legenda enviada junto com a mídia…' : 'Digite a mensagem a ser enviada…'}
          autoFocus
        />
      </label>

      {channels.length > 1 && (
        <label>
          Canal de envio
          <select value={channelId} onChange={e => setChannelId(e.target.value)}>
            {channels.map(c => (
              <option key={c.id} value={c.id}>
                {c.display_name}{c.phone_number ? ` · ${c.phone_number}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {blockedCloudApi && (
        <div className="alert-amber">
          <span>⚠</span>
          <p>Agendamento de mídia não está disponível em canais API Oficial (Cloud API). Escolha um canal API Voe.</p>
        </div>
      )}

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
            <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); setDateError(false) }} />
            <input type="time" value={dueTime} onChange={e => { setDueTime(e.target.value); setDateError(false) }} />
          </div>
        )}

        {dueDate && relativeLabel && (
          <p className={`activity-relative-label${relativeLabel.includes('atrasada') ? ' is-late' : ''}`}>
            {relativeLabel}
          </p>
        )}
        {dateError && !dueDate && <p className="error-text">Selecione uma data para o envio</p>}
      </div>

      <label className="schedule-pause-toggle">
        <input type="checkbox" checked={pauseOnReply} onChange={e => setPauseOnReply(e.target.checked)} />
        <span>Pausar se o contato responder antes do horário</span>
      </label>

      {error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {done && !error && <p className="schedule-success">✅ Mensagem agendada com sucesso.</p>}

      <button type="submit" className="secondary" disabled={!canSubmit}>
        <ClockIcon size={12} /> {saving ? 'Agendando…' : 'Agendar envio'}
      </button>
    </form>
  )
}
