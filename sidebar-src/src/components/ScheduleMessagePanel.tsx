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
// Visual: réplica de ScheduleDropdown.tsx + SmartDatePicker.tsx (presets
// com ícone, mini-calendário de "Personalizar", chip de horário relativo,
// toggle de "pausar se responder") — pedido explícito do Bruno depois de
// achar a primeira versão poluída visualmente. `conjunto de presets é o
// mesmo ramo "whatsapp" do SmartDatePicker real (`buildWhatsAppDatePresets`),
// diferente do conjunto "base" usado em Nova Atividade.
//
// "Personalizar" simplificado numa segunda rodada (achado testando: o
// layout de 2 colunas — calendário + lista de horários scrollável lado a
// lado — não cabia bem nos ~300px úteis da sidebar, ficava apertado e feio,
// e o scroll da lista de horários era ruim). Agora é só o calendário (mês
// inteiro de largura), com o `<input type="time">` nativo de "Hora
// personalizada" como único seletor de horário aqui — sem grade de
// horários em lista. Os presets da linha de cima (Em 1 hora, manhã 7h/8h/9h
// etc.) já cobrem os horários comuns; "Personalizar" é pra data/hora
// arbitrária mesmo, e um input nativo faz isso melhor que uma lista de
// 30 em 30min (nem deixa escolher 14h15, por ex.).
//
// Três origens de mídia possíveis, mesmo formulário:
// - Texto livre (sem `libraryItem`, sem anexo) — usado direto do cabeçalho.
// - Mídia da biblioteca (`libraryItem` com content_type !== 'text') — a
//   mídia em si não é editável (vem do modelo salvo), só a legenda.
// - Anexo novo (foto/vídeo/documento do dispositivo, ou áudio gravado na
//   hora) — sobe via POST /api/v1/media (gêmeo autenticado por token de
//   /api/whatsapp/upload-media no dashboard) antes de agendar; só disponível
//   quando não há mídia de biblioteca já fixada.
// Qualquer uma das duas últimas é bloqueada em canal Cloud API, igual ao
// real (`handleScheduleFromLibrary` — agendamento de mídia não é suportado
// nesse provedor).
//
// Gravar áudio abre uma ABA PRÓPRIA (StandaloneRecorderPage.tsx), não
// grava aqui dentro do iframe: getUserMedia dentro de um iframe embutido
// numa página de terceiro (web.whatsapp.com) é negado pelo Chrome mesmo
// com `allow="microphone"` no iframe — Permissions Policy delega o
// "direito de pedir", mas o Chrome só concede/pergunta de verdade a um
// contexto de navegação de topo. Confirmado testando ao vivo
// ("NotAllowedError"). A aba devolve o áudio gravado por
// chrome.runtime.sendMessage (broadcast — o listener abaixo pega).
//
// `conversation_id` não é enviado no metadata — o wa-send.worker resolve/
// cria a conversa sozinho a partir de channel_id + telefone do contato.

import { useEffect, useRef, useState } from 'react'
import { voeApi, ApiError } from '../lib/apiClient'
import { useChannels } from '../hooks/useChannels'
import {
  buildWhatsAppDatePresets, formatWhatsAppRelativeLabel,
  getDaysInMonth, getFirstDayOfWeek, WEEKDAY_INITIALS, MONTH_NAMES,
  type WhatsAppDatePreset,
} from '../lib/whatsappDatePresets'
import { extractStoragePathFromUrl } from '../lib/mediaStorage'
import { mimeToMediaType, validateMediaSize } from '../lib/mediaTypes'
import { base64ToFile } from '../lib/fileBase64'
import type { MessageLibraryItem } from '../hooks/useMessageLibrary'
import { TemplatePickerInline } from './TemplatePickerInline'
import { Spinner } from './Spinner'
import {
  CalendarIcon, CalendarDaysIcon, ClockIcon, SunIcon, ArrowRightIcon,
  ChevronLeftIcon, ChevronRightIcon, PaperclipIcon, MicIcon, XIcon, LayersIcon,
} from './Icons'

export const MEDIA_TYPE_LABEL: Record<string, string> = {
  audio: '🎵 Áudio',
  image: '🖼️ Imagem',
  video: '🎬 Vídeo',
  document: '📄 Documento',
}

const PRESET_ICONS = { clock: ClockIcon, sun: SunIcon, calendarDays: CalendarDaysIcon, arrowRight: ArrowRightIcon }

interface AttachedMedia {
  storagePath: string
  bucket: string
  mediaType: string
  fileName: string
  fileSize: number
}

interface UploadMediaResponse {
  storage_path: string
  media_bucket: string
  media_type: string
  mime_type: string
  file_name: string
  file_size: number
}

function pad(n: number) {
  return String(n).padStart(2, '0')
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
  // Estado, não deriva direto da prop: além do modelo que pode chegar pronto
  // de fora (fluxo antigo — Modelos de mensagens → Agendar), agora também dá
  // pra escolher um modelo DE DENTRO do agendamento (botão "Usar um modelo"
  // abaixo) — os dois caminhos convergem pro mesmo estado.
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<MessageLibraryItem | null>(libraryItem ?? null)
  const [showPicker, setShowPicker] = useState(false)
  const isLibraryMedia = !!selectedLibraryItem && selectedLibraryItem.content_type !== 'text'
  const [text, setText] = useState(libraryItem?.content ?? '')
  const [channelId, setChannelId] = useState('')
  const [pauseOnReply, setPauseOnReply] = useState(true)
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [dateError, setDateError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Anexo novo (foto/vídeo/documento do dispositivo, ou áudio gravado) —
  // só faz sentido quando não há mídia de biblioteca já fixada.
  const [attached, setAttached] = useState<AttachedMedia | null>(null)
  const [uploading, setUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [waitingForRecording, setWaitingForRecording] = useState(false)
  const photoVideoInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  const isMedia = isLibraryMedia || !!attached

  const presets = buildWhatsAppDatePresets()
  const relativeLabel = formatWhatsAppRelativeLabel(dueDate, dueTime)
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  // Auto-seleciona o único canal (ou o default, se vier mais de um); se
  // sobrar mais de uma opção o <select> abaixo aparece pro usuário escolher.
  useEffect(() => {
    if (channels.length === 0) return
    setChannelId(current => (current && channels.some(c => c.id === current) ? current : channels[0].id))
  }, [channels])

  const selectedChannel = channels.find(c => c.id === channelId)
  const blockedCloudApi = isMedia && selectedChannel?.provider === 'cloud_api'

  function applyPreset(preset: WhatsAppDatePreset) {
    const { date, time } = preset.getDateTime()
    setDueDate(date)
    setDueTime(time)
    setDateError(false)
    setShowCalendar(false)
  }

  function handleDayClick(day: number) {
    const d = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
    setDueDate(d)
    if (!dueTime) setDueTime('09:00')
    setDateError(false)
  }

  async function handleFilePicked(file: File) {
    setAttachError(null)
    const mediaType = mimeToMediaType(file.type)
    const { ok, limitMb } = validateMediaSize(mediaType, file.size)
    if (!ok) {
      setAttachError(`Arquivo excede o limite de ${limitMb}MB para ${mediaType}.`)
      return
    }
    if (!channelId) {
      setAttachError('Escolha um canal antes de anexar.')
      return
    }
    setUploading(true)
    try {
      const res = await voeApi.upload<UploadMediaResponse>('/api/v1/media', file, { channel_id: channelId })
      setAttached({
        storagePath: res.storage_path,
        bucket: res.media_bucket,
        mediaType: res.media_type,
        fileName: res.file_name,
        fileSize: res.file_size,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 413) {
        setAttachError(err.message)
      } else {
        setAttachError(err instanceof Error ? err.message : 'Erro ao enviar arquivo')
      }
    } finally {
      setUploading(false)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo depois
    if (file) handleFilePicked(file)
  }

  function handleOpenRecorderTab() {
    setAttachError(null)
    setWaitingForRecording(true)
    chrome.tabs.create({ url: chrome.runtime.getURL('sidebar/index.html?mode=recorder') })
  }

  // Escuta o áudio gravado na aba avulsa (StandaloneRecorderPage.tsx) —
  // chrome.runtime.sendMessage é broadcast, então o listener recebe mesmo
  // sem ter aberto a aba diretamente daqui (é o mesmo processo que abriu,
  // mas a entrega não depende de manter uma referência à aba).
  useEffect(() => {
    function handleMessage(message: { type?: string; fileBase64?: string; fileName?: string; fileType?: string }) {
      if (message?.type !== 'VOE_AUDIO_HANDOFF' || !message.fileBase64) return
      setWaitingForRecording(false)
      const file = base64ToFile(message.fileBase64, message.fileName || 'audio.webm', message.fileType || 'audio/webm')
      handleFilePicked(file)
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) } else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) } else setViewMonth(viewMonth + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)

  const canSubmit =
    !saving && !uploading && !blockedCloudApi && !!channelId && !!dueDate && (isMedia || text.trim().length > 0)

  // Por quê o botão está desabilitado, em texto — sem isso o motivo real
  // fica invisível pro usuário (achado: "o botão fica bloqueado sem motivo
  // nenhum" quase sempre tinha um motivo real, só não aparecia em lugar
  // nenhum). `blockedCloudApi` já tem seu próprio aviso (.alert-amber) mais
  // acima, não repete aqui.
  const blockReason =
    canSubmit || saving || blockedCloudApi ? null :
    uploading ? 'Aguardando o anexo terminar de enviar…' :
    !channelId ? 'Nenhum canal de WhatsApp disponível.' :
    !dueDate ? 'Escolha um dia acima (um atalho ou um número do calendário) — só a hora não basta.' :
    !isMedia && text.trim().length === 0 ? 'Escreva uma mensagem ou anexe algo.' :
    null

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
      if (isLibraryMedia && selectedLibraryItem) {
        metadata.media_type = selectedLibraryItem.content_type
        metadata.file_name = selectedLibraryItem.file_name
        metadata.content = trimmed || `[${selectedLibraryItem.title}]`
        const parsed = extractStoragePathFromUrl(selectedLibraryItem.file_url ?? '')
        if (parsed) {
          metadata.media_storage_path = parsed.path
          metadata.media_bucket = parsed.bucket
        } else {
          metadata.media_url = selectedLibraryItem.file_url
        }
        title = `📩 Agendada: ${selectedLibraryItem.title.slice(0, 40)}`
      } else if (attached) {
        metadata.media_type = attached.mediaType
        metadata.file_name = attached.fileName
        metadata.media_storage_path = attached.storagePath
        metadata.media_bucket = attached.bucket
        metadata.content = trimmed || `[${attached.fileName}]`
        title = `📩 Agendada: ${attached.fileName.slice(0, 40)}`
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
      setText('')
      setAttached(null)
      setSelectedLibraryItem(null)
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

  if (showPicker) {
    return (
      <TemplatePickerInline
        onClose={() => setShowPicker(false)}
        onSelect={item => {
          setSelectedLibraryItem(item)
          setText(item.content ?? '')
          setAttached(null) // um modelo substitui qualquer anexo solto que já tivesse
          setShowPicker(false)
        }}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="schedule-panel">
      <div className="schedule-panel-header">
        <ClockIcon size={13} />
        <span>Agendar envio</span>
      </div>

      <div className="schedule-content-card">
        {isLibraryMedia && selectedLibraryItem ? (
          <div className="schedule-media-preview">
            <span className="schedule-media-badge">{MEDIA_TYPE_LABEL[selectedLibraryItem.content_type] ?? selectedLibraryItem.content_type}</span>
            <strong>{selectedLibraryItem.file_name || selectedLibraryItem.title}</strong>
            <button type="button" className="link-button" onClick={() => setShowPicker(true)}>Trocar</button>
            <button type="button" className="schedule-media-remove" onClick={() => setSelectedLibraryItem(null)} title="Remover modelo">
              <XIcon size={11} />
            </button>
          </div>
        ) : null}

        {attached && (
          <div className="schedule-media-preview">
            <span className="schedule-media-badge">{MEDIA_TYPE_LABEL[attached.mediaType] ?? attached.mediaType}</span>
            <strong>{attached.fileName}</strong>
            <button type="button" className="schedule-media-remove" onClick={() => setAttached(null)} title="Remover anexo">
              <XIcon size={11} />
            </button>
          </div>
        )}

        {selectedLibraryItem && !isLibraryMedia ? (
          <div className="schedule-template-tag">
            <LayersIcon size={10} />
            <span>Modelo: {selectedLibraryItem.title}</span>
            <button type="button" className="link-button" onClick={() => setShowPicker(true)}>Trocar</button>
          </div>
        ) : !selectedLibraryItem && !attached && (
          <button type="button" className="schedule-use-template-btn" onClick={() => setShowPicker(true)}>
            <LayersIcon size={11} /> Usar um modelo
          </button>
        )}

        <textarea
          className="schedule-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={isMedia ? 2 : 3}
          placeholder={isMedia ? 'Legenda enviada junto com a mídia (opcional)…' : 'Digite a mensagem a ser enviada…'}
          autoFocus
        />

        {!isLibraryMedia && !attached && (
          <div className="schedule-attach-row">
            <button type="button" className="schedule-attach-btn" disabled={uploading} onClick={() => photoVideoInputRef.current?.click()}>
              <PaperclipIcon size={12} /> Foto/vídeo
            </button>
            <button type="button" className="schedule-attach-btn" disabled={uploading} onClick={() => documentInputRef.current?.click()}>
              <PaperclipIcon size={12} /> Documento
            </button>
            <button type="button" className="schedule-attach-btn" disabled={uploading} onClick={handleOpenRecorderTab}>
              {/* Continua clicável mesmo "aguardando" — se a aba de gravação foi fechada
                  sem terminar, não tem outro jeito de tentar de novo senão clicando aqui. */}
              <MicIcon size={12} /> {waitingForRecording ? 'Aguardando… (clique pra tentar de novo)' : 'Gravar áudio'}
            </button>
            {uploading && <Spinner label="Enviando…" />}
          </div>
        )}

        {waitingForRecording && (
          <p className="muted schedule-recorder-hint">
            Uma aba nova abriu pra gravar o áudio (o Chrome vai pedir permissão de microfone lá — autorize).
            Volte pra cá depois de gravar.
          </p>
        )}

        <input
          ref={photoVideoInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <input
          ref={documentInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {attachError && (
          <div className="error-banner">
            <span>⚠</span>
            <span>{attachError}</span>
          </div>
        )}

        {channels.length > 1 && (
          <div className="schedule-channel-row">
            <span>Canal:</span>
            <select value={channelId} onChange={e => setChannelId(e.target.value)}>
              {channels.map(c => (
                <option key={c.id} value={c.id}>
                  {c.display_name}{c.phone_number ? ` · ${c.phone_number}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {blockedCloudApi && (
        <div className="alert-amber">
          <span>⚠</span>
          <p>Agendamento de mídia não está disponível em canais API Oficial. Escolha um canal API Voe.</p>
        </div>
      )}

      <div className="schedule-when">
        <div className="schedule-when-header">
          <span className="form-label-standalone">
            <CalendarIcon size={12} /> Quando *
          </span>
          {dueDate && !showCalendar && (
            <button type="button" className="link-button" onClick={() => setShowCalendar(true)}>
              Personalizar
            </button>
          )}
        </div>

        <div className="schedule-presets">
          {presets.map(preset => {
            const { date, time } = preset.getDateTime()
            const isActive = dueDate === date && dueTime === time
            const PresetIcon = PRESET_ICONS[preset.icon]
            return (
              <button
                key={preset.label}
                type="button"
                className={`schedule-preset-pill${isActive ? ' is-active' : ''}`}
                onClick={() => applyPreset(preset)}
              >
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
                const isToday = dayStr === todayStr
                const isSelected = dayStr === dueDate
                const isPast = dayStr < todayStr
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleDayClick(day)}
                    className={`schedule-calendar-day${isSelected ? ' is-selected' : isToday ? ' is-today' : ''}`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            <div className="schedule-calendar-footer">
              <span>Horário:</span>
              <input
                type="time"
                value={dueTime}
                onChange={e => {
                  setDueTime(e.target.value)
                  // Espelha handleDayClick (que assume 09:00 se só a data foi
                  // escolhida): só mexer na hora aqui, sem nunca ter clicado um
                  // dia, deixava dueDate vazio pra sempre — o botão "Agendar
                  // envio" travava sem ficar óbvio que faltava especificamente
                  // clicar um número do calendário (achado testando ao vivo).
                  if (!dueDate) setDueDate(todayStr)
                }}
              />
              <button type="button" className="link-button" onClick={() => setShowCalendar(false)}>Fechar</button>
            </div>
          </div>
        )}

        {dueDate && relativeLabel && (
          <div className={`schedule-relative-chip${relativeLabel.includes('atrasada') ? ' is-late' : ''}`}>
            <CalendarIcon size={12} />
            {relativeLabel}
          </div>
        )}
        {dateError && !dueDate && <p className="error-text">Selecione uma data para o envio</p>}
      </div>

      <label className="schedule-pause-toggle-row">
        <button
          type="button"
          role="switch"
          aria-checked={pauseOnReply}
          className={`schedule-toggle${pauseOnReply ? ' is-on' : ''}`}
          onClick={() => setPauseOnReply(v => !v)}
        >
          <span className="schedule-toggle-dot" />
        </button>
        <span>Pausar se o contato responder antes do horário</span>
      </label>

      {error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {done && !error && <p className="schedule-success">✅ Mensagem agendada com sucesso.</p>}

      {blockReason && <p className="schedule-block-reason">{blockReason}</p>}

      <button type="submit" className="schedule-submit-btn" disabled={!canSubmit}>
        <CalendarDaysIcon size={13} /> {saving ? 'Agendando…' : 'Agendar envio'}
      </button>
    </form>
  )
}
