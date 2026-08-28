// CreateTemplateScreen.tsx
// Criar um modelo de mensagem novo — espelha createItem() em
// useMessageLibrary.ts (app.voeops.com), mas em dois passos via API (ao
// invés de insert direto no Supabase, que a extensão nunca fez até agora —
// consistente com o padrão já usado em tudo: canais, mídia de agendamento,
// gate de plano, sempre por /api/v1/*):
//   1. Se for mídia: POST /api/v1/message-library/media (upload pro bucket
//      "message-library" — diferente do bucket "media" usado no anexo de
//      agendamento — devolve file_url já pronta, signed 1h, igual ao real).
//   2. POST /api/v1/message-library (cria a linha).
//
// Reaproveita a MESMA infraestrutura de anexo/gravação de áudio já
// construída pro agendamento (voeApi.upload, backgroundUploadFile,
// StandaloneRecorderPage + broadcast VOE_AUDIO_HANDOFF) — só troca o
// endpoint de destino.
//
// Fora de escopo (mantém a tela enxuta, sem poluição visual — pedido
// explícito): carrossel, tags, transcrição automática de áudio
// (`/api/transcribe` no dashboard), taxonomia customizada de categorias
// (usa as 11 categorias padrão — messageLibraryCategories.ts).

import { useEffect, useState } from 'react'
import { voeApi, ApiError } from '../lib/apiClient'
import { mimeToMediaType, validateMediaSize } from '../lib/mediaTypes'
import { base64ToFile } from '../lib/fileBase64'
import { DEFAULT_CATEGORIES } from '../lib/messageLibraryCategories'
import { TYPE_ICONS } from './TemplatePickerInline'
import { Spinner } from './Spinner'
import { ChevronLeftIcon, PaperclipIcon, MicIcon, XIcon } from './Icons'

type ContentType = 'text' | 'audio' | 'image' | 'video' | 'document'

const TYPES: { key: ContentType; label: string }[] = [
  { key: 'text', label: 'Texto' },
  { key: 'audio', label: 'Áudio' },
  { key: 'image', label: 'Imagem' },
  { key: 'video', label: 'Vídeo' },
  { key: 'document', label: 'Documento' },
]

const ACCEPT_BY_TYPE: Record<ContentType, string | undefined> = {
  text: undefined,
  audio: 'audio/*',
  image: 'image/*',
  video: 'video/*',
  document: undefined,
}

interface UploadedMedia {
  fileUrl: string
  fileName: string
  fileSize: number
}

interface Props {
  onCreated: () => void
  onClose: () => void
}

export function CreateTemplateScreen({ onCreated, onClose }: Props) {
  const [contentType, setContentType] = useState<ContentType>('text')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('geral')
  const [content, setContent] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [media, setMedia] = useState<UploadedMedia | null>(null)
  const [uploading, setUploading] = useState(false)
  const [waitingForRecording, setWaitingForRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMediaType = contentType !== 'text'

  // Escuta o áudio gravado na aba avulsa — mesmo broadcast usado em
  // ScheduleMessagePanel.tsx (StandaloneRecorderPage.tsx).
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
  }, [contentType])

  function handleTypeChange(type: ContentType) {
    setContentType(type)
    setMedia(null)
    setError(null)
  }

  async function handleFilePicked(file: File) {
    setError(null)
    const detectedType = mimeToMediaType(file.type)
    const { ok, limitMb } = validateMediaSize(detectedType, file.size)
    if (!ok) {
      setError(`Arquivo excede o limite de ${limitMb}MB para ${detectedType}.`)
      return
    }
    setUploading(true)
    try {
      const res = await voeApi.upload<{ file_url: string; file_name: string; file_size: number }>(
        '/api/v1/message-library/media', file, { content_type: contentType },
      )
      setMedia({ fileUrl: res.file_url, fileName: res.file_name, fileSize: res.file_size })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar arquivo')
    } finally {
      setUploading(false)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleFilePicked(file)
  }

  function handleOpenRecorderTab() {
    setError(null)
    setWaitingForRecording(true)
    chrome.tabs.create({ url: chrome.runtime.getURL('sidebar/index.html?mode=recorder') })
  }

  const canSubmit =
    !saving && !uploading && title.trim().length > 0 && (isMediaType ? !!media : content.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await voeApi.post('/api/v1/message-library', {
        title: title.trim(),
        content_type: contentType,
        content: isMediaType ? (content.trim() || null) : content.trim(),
        file_url: media?.fileUrl ?? null,
        file_name: media?.fileName ?? null,
        file_size: media?.fileSize ?? null,
        category,
        is_favorite: isFavorite,
      })
      onCreated()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao criar modelo')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="schedule-panel">
      <div className="template-picker-header">
        <button type="button" className="back-button-danger" onClick={onClose}>
          <ChevronLeftIcon size={13} /> Voltar
        </button>
        <span>Novo modelo</span>
      </div>

      <div className="template-type-row">
        {TYPES.map(({ key, label }) => {
          const Icon = TYPE_ICONS[key]
          return (
            <button
              key={key}
              type="button"
              className={`template-type-btn${contentType === key ? ' is-active' : ''}`}
              onClick={() => handleTypeChange(key)}
            >
              <Icon size={13} />
              {label}
            </button>
          )
        })}
      </div>

      <label>
        Título
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Boas-vindas ao cliente" autoFocus />
      </label>

      <label>
        Categoria
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {DEFAULT_CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </label>

      {contentType === 'text' ? (
        <label>
          Mensagem
          <textarea
            className="schedule-textarea"
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            placeholder="Digite o texto do modelo…"
          />
        </label>
      ) : (
        <div className="schedule-content-card">
          {media && (
            <div className="schedule-media-preview">
              <strong>{media.fileName}</strong>
              <button type="button" className="schedule-media-remove" onClick={() => setMedia(null)} title="Remover">
                <XIcon size={11} />
              </button>
            </div>
          )}

          {!media && (
            <div className="schedule-attach-row">
              <label className="schedule-attach-btn">
                <PaperclipIcon size={12} /> Escolher arquivo
                <input
                  type="file"
                  accept={ACCEPT_BY_TYPE[contentType]}
                  style={{ display: 'none' }}
                  onChange={handleFileInputChange}
                />
              </label>
              {contentType === 'audio' && (
                <button type="button" className="schedule-attach-btn" disabled={waitingForRecording} onClick={handleOpenRecorderTab}>
                  <MicIcon size={12} /> {waitingForRecording ? 'Aguardando gravação…' : 'Gravar áudio'}
                </button>
              )}
              {uploading && <Spinner label="Enviando…" />}
            </div>
          )}

          {waitingForRecording && (
            <p className="muted schedule-recorder-hint">
              Uma aba nova abriu pra gravar o áudio (autorize o microfone lá). Volte pra cá depois.
            </p>
          )}

          <label>
            Legenda (opcional)
            <textarea
              className="schedule-textarea"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={2}
              placeholder="Texto enviado junto com a mídia…"
            />
          </label>
        </div>
      )}

      <label className="schedule-pause-toggle-row">
        <button
          type="button"
          role="switch"
          aria-checked={isFavorite}
          className={`schedule-toggle${isFavorite ? ' is-on' : ''}`}
          onClick={() => setIsFavorite(v => !v)}
        >
          <span className="schedule-toggle-dot" />
        </button>
        <span>Marcar como favorito</span>
      </label>

      {error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <button type="submit" className="schedule-submit-btn" disabled={!canSubmit}>
        {saving ? 'Criando…' : 'Criar modelo'}
      </button>
    </form>
  )
}
