// WhatsAppActivitySection.tsx
// Seção "Configuração WhatsApp" + "Resumo do agendamento" do Nova Atividade —
// réplica do ramo `type === "whatsapp"` do ActivityModal.tsx do dashboard:
// - Canal de envio em cards (Wifi conectado / WifiOff, "API Oficial"/"API Voe"
//   · telefone, badge Cloud/Voe). Trocar de canal limpa o conteúdo.
// - API Oficial (cloud_api): lista de templates aprovados DAQUELE canal com
//   busca, filtro Todos/Marketing/Utilidade, tags e arquivados; ao escolher,
//   "Preencher variáveis" ({{1}} já vem com o nome do contato) + preview.
//   No real são duas colunas lado a lado; aqui a sidebar (~340px) não comporta,
//   então ficam empilhadas.
// - API Voe (evolution_go): Central de Mensagens (só itens de texto) com busca,
//   "Nova mensagem" e chips de categoria; editor "Escrever nova mensagem" /
//   "Editar mensagem" com {{ Variáveis; "Anexar arquivo" (a mensagem vira
//   legenda).
// - "Pausar envio se o contato responder antes" (ligado por padrão).
//
// O estado mora em useWhatsAppActivityForm (o NewActivityModal precisa dele
// pra validar e montar o metadata no submit), a UI aqui só renderiza.

import { useEffect, useMemo, useRef, useState } from 'react'
import { voeApi, ApiError, type ApiScope } from '../lib/apiClient'
import { supabase } from '../lib/supabaseClient'
import { getActiveWorkspace } from '../lib/workspaceStorage'
import { useChannels, type WhatsAppChannel } from '../hooks/useChannels'
import { useMessageLibrary, type MessageLibraryItem } from '../hooks/useMessageLibrary'
import { useMessageLabels } from '../hooks/useMessageLabels'
import {
  useWaTemplates, isArchived, tagTone, collectTags, countTemplateVars, readableTemplateName,
  ARCHIVED_TAG, type WaTemplate,
} from '../hooks/useWaTemplates'
import { mimeToMediaType, validateMediaSize } from '../lib/mediaTypes'
import { toShortVariableSyntax, type VariableContext } from '../lib/messageVariables'
import { TemplatePreview } from './TemplatePreview'
import { VariablePickerButton, VariableText, VariableTextarea } from './MessageVariables'
import { Spinner } from './Spinner'
import {
  AlertIcon, ArchiveIcon, CalendarIcon, ClockIcon, FileTextIcon, MessageCircleIcon, PaperclipIcon,
  PenLineIcon, SearchIcon, SmartphoneIcon, StarIcon, TagIcon, WifiIcon, WifiOffIcon, XIcon,
} from './Icons'

interface AttachedMedia {
  storage_path: string
  media_bucket: string
  media_type: string
  mime_type?: string
  file_name: string
}

/** Escopo (usuário + workspace ativo) pros hooks da Central de Mensagens. */
function useApiScope() {
  const [scope, setScope] = useState<ApiScope | null>(null)
  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id
      const workspace = userId ? await getActiveWorkspace(userId) : null
      if (active && userId && workspace) setScope({ userId, workspaceId: workspace.id })
    })
    return () => { active = false }
  }, [])
  return scope
}

export function useWhatsAppActivityForm({ enabled, contactName, onSuggestTitle }: {
  enabled: boolean
  contactName: string | null
  /** Título automático (nome do template / título do item da Central). */
  onSuggestTitle: (title: string, previousSuggestion: string | null) => void
}) {
  const { channels, loading: loadingChannels, error: channelsError } = useChannels()
  const { templates, loading: loadingTemplates, error: templatesError } = useWaTemplates(enabled)
  const { messages: libraryMessages, loading: loadingLibrary } = useMessageLibrary()

  const [channelId, setChannelId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [variables, setVariables] = useState<string[]>([])
  const [pauseOnReply, setPauseOnReply] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [messageContent, setMessageContent] = useState('')
  const [selectedLibraryId, setSelectedLibraryId] = useState('')
  const [librarySearch, setLibrarySearch] = useState('')
  const [media, setMedia] = useState<AttachedMedia | null>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [channelError, setChannelError] = useState(false)
  const lastSuggestion = useRef<string | null>(null)

  const selectedChannel = channels.find(c => c.id === channelId)
  const provider = selectedChannel?.provider as 'cloud_api' | 'evolution_go' | undefined
  const selectedTemplate = templates.find(t => t.id === templateId) ?? null
  const libraryItems = libraryMessages.filter(item => item.content_type === 'text')

  useEffect(() => () => { if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl) }, [mediaPreviewUrl])

  function suggestTitle(title: string) {
    onSuggestTitle(title, lastSuggestion.current)
    lastSuggestion.current = title
  }

  function selectChannel(id: string) {
    setChannelId(id)
    setChannelError(false)
    setTemplateId(''); setVariables([]); setSearch('')
    setMessageContent(''); setSelectedLibraryId(''); setLibrarySearch('')
  }

  function selectTemplate(t: WaTemplate) {
    setTemplateId(t.id)
    suggestTitle(readableTemplateName(t.name))
    const initial: string[] = Array(countTemplateVars(t.components)).fill('')
    if (initial.length >= 1 && contactName) initial[0] = contactName
    setVariables(initial)
  }

  function selectLibraryItem(item: MessageLibraryItem) {
    setSelectedLibraryId(item.id)
    setMessageContent(toShortVariableSyntax(item.content ?? ''))
    suggestTitle(item.title || 'WhatsApp agendado')
  }

  async function attachFile(file: File) {
    setMediaError(null)
    if (!channelId) { setChannelError(true); return }
    const { ok, limitMb } = validateMediaSize(mimeToMediaType(file.type), file.size)
    if (!ok) { setMediaError(`Arquivo excede o limite de ${limitMb}MB.`); return }
    setMediaUploading(true)
    try {
      const res = await voeApi.upload<{ storage_path: string; media_bucket: string; media_type: string; mime_type: string; file_name: string }>(
        '/api/v1/media', file, { channel_id: channelId },
      )
      setMedia({ storage_path: res.storage_path, media_bucket: res.media_bucket, media_type: res.media_type, mime_type: res.mime_type, file_name: res.file_name })
      setMediaPreviewUrl(res.media_type === 'image' || res.media_type === 'video' ? URL.createObjectURL(file) : null)
      setSelectedLibraryId('') // mídia anexada tem precedência sobre item da Central
    } catch (err) {
      setMediaError(err instanceof ApiError || err instanceof Error ? err.message : 'Erro ao anexar o arquivo.')
    } finally {
      setMediaUploading(false)
    }
  }

  function clearMedia() {
    setMedia(null)
    setMediaPreviewUrl(null)
  }

  // Número, modelo/mensagem, data e horário são obrigatórios (mesma regra
  // de isWhatsAppScheduleValid do dashboard). "Modelo" depende do provedor.
  const messageReady = provider === 'cloud_api'
    ? !!templateId
    : !!(messageContent.trim() || media || selectedLibraryId)

  /** metadata da atividade — buildMetadata() do ActivityModal, ramo whatsapp. */
  function buildMetadata(): Record<string, unknown> {
    if (provider === 'evolution_go') {
      if (media) {
        return {
          channel_id: channelId, send_type: 'media',
          media_type: media.media_type, media_storage_path: media.storage_path, media_bucket: media.media_bucket,
          mime_type: media.mime_type, file_name: media.file_name,
          content: messageContent || undefined, // vira legenda
          pause_on_reply: pauseOnReply, sent_at: null, replied_at: null,
        }
      }
      const libItem = libraryItems.find(li => li.id === selectedLibraryId)
      return {
        channel_id: channelId, send_type: 'message',
        content: messageContent || libItem?.content || undefined,
        pause_on_reply: pauseOnReply, sent_at: null, replied_at: null,
      }
    }
    const varsObj: Record<string, string> = {}
    variables.forEach((v, i) => { if (v) varsObj[`${i + 1}`] = v })
    return {
      channel_id: channelId,
      template_id: templateId || undefined,
      template_name: selectedTemplate?.name,
      template_language: selectedTemplate?.language ?? 'pt_BR',
      template_variables: Object.keys(varsObj).length > 0 ? varsObj : undefined,
      pause_on_reply: pauseOnReply, sent_at: null, replied_at: null,
    }
  }

  return {
    channels, loadingChannels, channelsError, templates, loadingTemplates, templatesError, libraryItems, loadingLibrary,
    channelId, selectChannel, selectedChannel, provider, channelError, setChannelError,
    templateId, selectedTemplate, selectTemplate, variables, setVariables,
    search, setSearch, filterCat, setFilterCat, filterTags, setFilterTags, showArchived, setShowArchived,
    messageContent, setMessageContent, selectedLibraryId, setSelectedLibraryId, selectLibraryItem, librarySearch, setLibrarySearch,
    media, mediaUploading, mediaPreviewUrl, mediaError, attachFile, clearMedia,
    pauseOnReply, setPauseOnReply, messageReady, buildMetadata,
  }
}

export type WhatsAppActivityForm = ReturnType<typeof useWhatsAppActivityForm>

// ── UI ───────────────────────────────────────────────────────────────────

export function WhatsAppConfigSection({ form, contactError, variableContext }: {
  form: WhatsAppActivityForm
  contactError: boolean
  variableContext: VariableContext | null
}) {
  return (
    <div className="wa-section">
      <h4 className="wa-section-title"><MessageCircleIcon size={13} /> Configuração WhatsApp</h4>

      {contactError && (
        <div className="wa-alert"><AlertIcon size={13} /> Selecione um contato para agendar uma mensagem WhatsApp</div>
      )}
      {form.channelError && (
        <div className="wa-alert"><AlertIcon size={13} /> Selecione o canal de envio para agendar a mensagem</div>
      )}

      <div>
        <span className="form-label-standalone"><SmartphoneIcon size={12} /> Canal de envio</span>
        {form.loadingChannels ? <Spinner label="Carregando canais…" /> : form.channelsError ? (
          <div className="wa-alert"><AlertIcon size={13} /> {form.channelsError}</div>
        ) : form.channels.length === 0 ? (
          <div className="wa-empty-box">Nenhum canal disponível. Configure um canal WhatsApp nas configurações.</div>
        ) : (
          <div className="wa-channel-grid">
            {form.channels.map(ch => <ChannelCard key={ch.id} channel={ch} selected={ch.id === form.channelId} onSelect={() => form.selectChannel(ch.id)} />)}
          </div>
        )}
      </div>

      {form.channelId && form.provider === 'cloud_api' && <CloudTemplatePicker form={form} />}
      {form.channelId && form.provider === 'evolution_go' && <LibraryMessageEditor form={form} variableContext={variableContext} />}

      {!form.channelId && form.channels.length > 0 && (
        <div className="wa-empty-box is-center"><SmartphoneIcon size={13} /> Selecione um canal acima para configurar a mensagem</div>
      )}

      {form.channelId && (
        <label className="wa-pause-row">
          <button type="button" role="switch" aria-checked={form.pauseOnReply}
            className={`schedule-toggle${form.pauseOnReply ? ' is-on' : ''}`}
            onClick={() => form.setPauseOnReply(v => !v)}>
            <span className="schedule-toggle-dot" />
          </button>
          <span>Pausar envio se o contato responder antes</span>
        </label>
      )}
    </div>
  )
}

function ChannelCard({ channel, selected, onSelect }: { channel: WhatsAppChannel; selected: boolean; onSelect: () => void }) {
  const isCloud = channel.provider === 'cloud_api'
  const connected = channel.connection_status === 'connected'
  return (
    <button type="button" className={`wa-channel-card${selected ? ' is-selected' : ''}`} onClick={onSelect}>
      {connected ? <WifiIcon size={14} className="wa-wifi-on" /> : <WifiOffIcon size={14} className="wa-wifi-off" />}
      <span className="wa-channel-info">
        <span className="wa-channel-name">{channel.display_name}</span>
        <span className="wa-channel-sub">{isCloud ? 'API Oficial' : 'API Voe'}{channel.phone_number && ` · ${channel.phone_number}`}</span>
      </span>
      <span className={`wa-channel-badge ${isCloud ? 'is-cloud' : 'is-voe'}`}>{isCloud ? 'Cloud' : 'Voe'}</span>
    </button>
  )
}

const TEMPLATE_CATEGORIES = [
  { value: '', label: 'Todos' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'UTILITY', label: 'Utilidade' },
]

function CloudTemplatePicker({ form }: { form: WhatsAppActivityForm }) {
  // Cada canal API Oficial tem sua WABA — template só sai pelo canal em que foi aprovado.
  const channelTemplates = useMemo(() => form.templates.filter(t => t.connection_id === form.channelId), [form.templates, form.channelId])
  const allTags = useMemo(() => collectTags(channelTemplates), [channelTemplates])
  const archivedCount = channelTemplates.filter(isArchived).length
  const q = form.search.toLowerCase()
  const filtered = channelTemplates.filter(t =>
    (form.showArchived || !isArchived(t)) &&
    (!form.filterCat || t.category === form.filterCat) &&
    (!q || t.name.toLowerCase().includes(q)) &&
    form.filterTags.every(tag => (t.tags ?? []).includes(tag)))

  return (
    <div className="wa-box">
      <div className="wa-box-filters">
        <div className="wa-search">
          <SearchIcon size={12} />
          <input value={form.search} onChange={e => form.setSearch(e.target.value)} placeholder="Buscar por nome..." />
        </div>
        <div className="wa-cat-tabs">
          {TEMPLATE_CATEGORIES.map(c => (
            <button key={c.value} type="button" className={form.filterCat === c.value ? 'is-active' : ''} onClick={() => form.setFilterCat(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="wa-chips">
            {allTags.map(tag => {
              const active = form.filterTags.includes(tag)
              return (
                <button key={tag} type="button" className={`wa-tag-chip${active ? ` is-active tone-${tagTone(tag)}` : ''}`}
                  onClick={() => form.setFilterTags(prev => (active ? prev.filter(t => t !== tag) : [...prev, tag]))}>
                  <TagIcon size={8} />{tag}{active && <XIcon size={8} />}
                </button>
              )
            })}
          </div>
        )}
        {archivedCount > 0 && (
          <button type="button" className={`wa-archive-toggle${form.showArchived ? ' is-active' : ''}`} onClick={() => form.setShowArchived(v => !v)}>
            <ArchiveIcon size={10} /> {form.showArchived ? 'Ocultar arquivados' : `Ver arquivados (${archivedCount})`}
          </button>
        )}
      </div>

      <div className="wa-box-list">
        {form.loadingTemplates && <Spinner label="Carregando templates…" />}
        {form.templatesError && <p className="wa-list-empty">{form.templatesError}</p>}
        {!form.loadingTemplates && !form.templatesError && filtered.length === 0 && (
          <p className="wa-list-empty">
            {form.filterTags.length > 0 || form.filterCat || form.search ? 'Nenhum template com esses filtros' : 'Nenhum template aprovado'}
          </p>
        )}
        {filtered.map(t => {
          const archived = isArchived(t)
          const tags = (t.tags ?? []).filter(tag => tag !== ARCHIVED_TAG)
          return (
            <button key={t.id} type="button"
              className={`wa-list-item${t.id === form.templateId ? ' is-active' : ''}${archived ? ' is-archived' : ''}`}
              onClick={() => form.selectTemplate(t)}>
              <span className="wa-list-item-title">{archived && <ArchiveIcon size={9} />}{t.name}</span>
              <span className="wa-list-item-sub">{t.category === 'MARKETING' ? 'Marketing' : 'Utilidade'}</span>
              {tags.length > 0 && (
                <span className="wa-chips">
                  {tags.map(tag => <span key={tag} className={`wa-tag-chip is-active is-static tone-${tagTone(tag)}`}>{tag}</span>)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="wa-template-detail">
        {!form.selectedTemplate ? (
          <div className="wa-template-empty">
            <MessageCircleIcon size={28} />
            <p>Selecione um template acima</p>
          </div>
        ) : (
          <>
            {form.variables.length > 0 && (
              <div>
                <p className="wa-subtitle">Preencher variáveis</p>
                <div className="wa-vars">
                  {form.variables.map((v, i) => (
                    <div key={i} className="wa-var-row">
                      <span>{`{{${i + 1}}}`}</span>
                      <input value={v} placeholder={i === 0 ? 'Nome do contato' : `Valor para {{${i + 1}}}`}
                        onChange={e => form.setVariables(prev => prev.map((x, idx) => (idx === i ? e.target.value : x)))} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <TemplatePreview components={form.selectedTemplate.components} variableValues={form.variables} />
          </>
        )}
      </div>
    </div>
  )
}

function LibraryMessageEditor(props: { form: WhatsAppActivityForm; variableContext: VariableContext | null }) {
  // As categorias da Central são por workspace — espera o escopo antes de buscar.
  const scope = useApiScope()
  if (!scope) return <Spinner label="Carregando central de mensagens…" />
  return <LibraryMessageEditorInner {...props} scope={scope} />
}

function LibraryMessageEditorInner({ form, variableContext, scope }: { form: WhatsAppActivityForm; variableContext: VariableContext | null; scope: ApiScope }) {
  const { categories } = useMessageLabels(scope)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  let filtered = form.libraryItems
  if (form.librarySearch.startsWith('cat:')) {
    const cat = form.librarySearch.slice(4)
    filtered = filtered.filter(item => item.category === cat)
  } else if (form.librarySearch) {
    const q = form.librarySearch.toLowerCase()
    filtered = filtered.filter(item => item.title?.toLowerCase().includes(q) || item.content?.toLowerCase().includes(q))
  }

  function insertVariable(token: string) {
    const ta = textareaRef.current
    const value = form.messageContent
    if (!ta) { form.setMessageContent(value + token); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    form.setMessageContent(value.substring(0, start) + token + value.substring(end))
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + token.length, start + token.length) })
  }

  return (
    <div className="wa-library">
      <div className="wa-box">
        <div className="wa-box-filters">
          <div className="wa-library-search-row">
            <div className="wa-search">
              <SearchIcon size={12} />
              <input value={form.librarySearch} onChange={e => form.setLibrarySearch(e.target.value)} placeholder="Buscar na central de mensagens..." />
            </div>
            <button type="button"
              className={`wa-new-message-btn${!form.selectedLibraryId && form.messageContent ? ' is-active' : ''}`}
              onClick={() => { form.setSelectedLibraryId(''); form.setMessageContent('') }}>
              <PenLineIcon size={11} /> Nova mensagem
            </button>
          </div>
          <div className="wa-chips">
            {categories.map(c => (
              <button key={c.slug} type="button"
                className={`wa-cat-chip${form.librarySearch === `cat:${c.slug}` ? ' is-active' : ''}`}
                onClick={() => form.setLibrarySearch(prev => (prev === `cat:${c.slug}` ? '' : `cat:${c.slug}`))}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="wa-box-list is-short">
          {form.loadingLibrary && form.libraryItems.length === 0 && <Spinner label="Carregando mensagens…" />}
          {!form.loadingLibrary && filtered.length === 0 && (
            <p className="wa-list-empty">{form.librarySearch ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem na central'}</p>
          )}
          {filtered.map(item => (
            <button key={item.id} type="button"
              className={`wa-list-item is-library${item.id === form.selectedLibraryId ? ' is-active' : ''}`}
              onClick={() => form.selectLibraryItem(item)}>
              <span className="wa-list-item-main">
                <span className="wa-list-item-title">
                  {item.is_favorite && <StarIcon size={10} className="wa-star" />}
                  {item.title}
                </span>
                <span className="wa-list-item-sub is-truncate"><VariableText text={item.content} context={variableContext} /></span>
              </span>
              {item.category && (
                <span className="wa-list-item-cat">{categories.find(c => c.slug === item.category)?.name ?? item.category}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="wa-editor-header">
          <span className="form-label-standalone">{form.selectedLibraryId ? 'Editar mensagem' : 'Escrever nova mensagem'}</span>
          <VariablePickerButton onInsert={insertVariable} />
        </div>
        <VariableTextarea ref={textareaRef} value={form.messageContent} onValueChange={form.setMessageContent}
          variableContext={variableContext} rows={3} placeholder="Olá {{primeiro_nome}}, tudo bem?" />
      </div>

      <div>
        <input ref={fileInputRef} type="file" hidden
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) form.attachFile(f) }} />
        {!form.media ? (
          <button type="button" className="wa-attach-btn" disabled={form.mediaUploading} onClick={() => fileInputRef.current?.click()}>
            {form.mediaUploading ? <>Enviando arquivo...</> : <><PaperclipIcon size={13} /> Anexar arquivo</>}
          </button>
        ) : (
          <div className="wa-attached">
            {form.mediaPreviewUrl && form.media.media_type === 'image' && <img src={form.mediaPreviewUrl} alt="" />}
            {form.mediaPreviewUrl && form.media.media_type === 'video' && <video src={form.mediaPreviewUrl} />}
            {!form.mediaPreviewUrl && <span className="wa-attached-icon"><FileTextIcon size={16} /></span>}
            <span className="wa-attached-info">
              <span className="wa-attached-name">{form.media.file_name}</span>
              <span className="wa-attached-type">{form.media.media_type}</span>
            </span>
            <button type="button" onClick={form.clearMedia} aria-label="Remover arquivo"><XIcon size={14} /></button>
          </div>
        )}
        {form.mediaError && <p className="error-text">{form.mediaError}</p>}
        <p className="wa-hint">A mensagem acima vira a legenda do arquivo.</p>
      </div>
    </div>
  )
}

/** "Resumo do agendamento" — bloco verde no fim do modal, igual ao real. */
export function WhatsAppScheduleSummary({ form, contactName, contactPhone, dueDate, dueTime }: {
  form: WhatsAppActivityForm
  contactName: string | null
  contactPhone: string | null
  dueDate: string
  dueTime: string
}) {
  if (!dueDate || !form.channelId || !(form.selectedTemplate || form.messageContent)) return null
  const isCloud = form.provider === 'cloud_api'
  const msg = form.messageContent
  const when = new Date(`${dueDate}T${dueTime || '12:00'}:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  return (
    <div className="wa-summary">
      <h4><CalendarIcon size={13} /> Resumo do agendamento</h4>
      <p><strong>Canal:</strong> {form.selectedChannel?.display_name || '—'} <span>({isCloud ? 'API Oficial' : 'API Voe'})</span></p>
      <p><strong>Para:</strong> {contactName || 'Contato'}{contactPhone && <span> ({contactPhone})</span>}</p>
      <p>
        <strong>{isCloud ? 'Template:' : 'Mensagem:'}</strong>{' '}
        {isCloud ? form.selectedTemplate?.name || '—' : `${msg.slice(0, 50)}${msg.length > 50 ? '...' : ''}` || '—'}
      </p>
      <p><ClockIcon size={11} /> <strong>Envio:</strong> {when}{dueTime && ` às ${dueTime}`}</p>
      {form.pauseOnReply && <p className="wa-summary-pause">⏸ Envio será pausado se o contato responder antes</p>}
    </div>
  )
}
