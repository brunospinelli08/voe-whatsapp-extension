import { useEffect, useMemo, useRef, useState } from 'react'
import { useMessageLibrary, type MessageLibraryItem } from '../hooks/useMessageLibrary'
import { useMessageCenterPreferences } from '../hooks/useMessageCenterPreferences'
import { useMessageLabels } from '../hooks/useMessageLabels'
import { pasteTextIntoChat, sendMediaIntoChat } from '../lib/pasteIntoChat'
import { categoryLabel, CENTER_TYPES, messageSearchText, normalizeSearch, resolveMessage, type MessageCenterContext } from '../lib/messageCenter'
import { resolveLibraryMediaUrl } from '../lib/libraryMedia'
import { VOE_API_BASE } from '../config'
import { Spinner } from './Spinner'
import { BookOpenIcon, ChevronRightIcon, SearchIcon, XIcon, ExternalLinkIcon } from './Icons'

export function MessageCenterToggle({ onClick }: { onClick: () => void }) {
  return <button type="button" className="msg-center-toggle" onClick={onClick}>
    <span className="msg-center-toggle-icon"><BookOpenIcon size={14} /></span>
    Central de Mensagens <ChevronRightIcon size={13} className="msg-center-toggle-chevron" />
  </button>
}

function MessagePreview({ item, context }: { item: MessageLibraryItem; context: MessageCenterContext }) {
  const text = resolveMessage(item.content ?? '', context)
  const [media, setMedia] = useState({ url: '', error: '' })
  useEffect(() => {
    let active = true
    setMedia({ url: '', error: '' })
    if (item.file_url) void resolveLibraryMediaUrl(item.file_url, context.scope, item.id)
      .then(url => { if (active) setMedia({ url, error: '' }) })
      .catch(error => { if (active) setMedia({ url: '', error: error.message }) })
    return () => { active = false }
  }, [item.id, item.file_url, context.scope.userId, context.scope.workspaceId])
  const previewFailed = () => setMedia(previous => ({ ...previous, error: 'Prévia indisponível neste navegador. Você ainda pode confirmar o envio do arquivo.' }))
  return <div className="mc-preview">
    {text.content && <p>{text.content}</p>}
    {text.missing.length > 0 && <p className="mc-warning">Falta preencher: {text.missing.join(', ')}. Revise antes de enviar.</p>}
    {media.url && item.content_type === 'audio' && <audio controls preload="none" src={media.url} onError={previewFailed} aria-label={item.title} />}
    {media.url && item.content_type === 'video' && <video controls preload="none" src={media.url} onError={previewFailed} aria-label={item.title} />}
    {media.url && item.content_type === 'image' && <img loading="lazy" src={media.url} onError={previewFailed} alt={item.title} />}
    {media.url && item.content_type === 'document' && <a href={media.url} target="_blank" rel="noopener noreferrer">Abrir documento <ExternalLinkIcon size={12} /></a>}
    {media.error && <p className="mc-warning" role="status">{media.error}</p>}
    {item.content_type === 'carousel' && <>
      <div className="mc-carousel">{item.carousel_cards?.map((card, i) => <div key={i}>
        {card.header_type === 'image' ? <img loading="lazy" src={card.header_url} alt={`Cartão ${i + 1}`} /> : <video controls preload="none" src={card.header_url} />}
        {card.body_text && <p>{card.body_text}</p>}
      </div>)}</div>
      <p className="muted">O envio deste formato está disponível no painel da Voe.</p>
    </>}
  </div>
}

interface Props {
  context: MessageCenterContext
  onClose: () => void
  docked?: boolean
  visible?: boolean
}

export function MessageCenterScreen({ context, onClose, docked = false, visible = true }: Props) {
  const { messages, loading, refreshing, error, refetch } = useMessageLibrary(context.scope)
  const [prefs, setPrefs] = useMessageCenterPreferences(context.scope)
  const { labels, categories: configuredCategories, error: labelsError } = useMessageLabels(context.scope)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [review, setReview] = useState<{ id: string; caption: string } | null>(null)
  const [action, setAction] = useState<{ id: string; status: 'pending' | 'done' | 'error'; message: string } | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const currentPhone = useRef(context.chat?.phone)
  const insertion = useRef<AbortController | null>(null)
  const generation = useRef(0)
  currentPhone.current = context.chat?.phone

  useEffect(() => {
    generation.current++
    insertion.current?.abort()
    insertion.current = null
    setExpanded(null)
    setReview(null)
    setAction(null)
    return () => { generation.current++; insertion.current?.abort() }
  }, [context.chat?.phone, context.scope.userId, context.scope.workspaceId])

  useEffect(() => {
    if (visible) {
      searchRef.current?.focus()
      window.dispatchEvent(new Event('voe-center-open'))
    } else { setExpanded(null); setReview(null) }
  }, [visible])

  const indexed = useMemo(() => messages.map(item => ({ item, text: messageSearchText(item, labels) })), [messages, labels])
  const categories = useMemo(() => {
    const extra = [...new Set(messages.map(item => item.category || 'geral'))].filter(slug => !configuredCategories.some(category => category.slug === slug))
    return [...configuredCategories, ...extra.map(slug => ({ slug, name: categoryLabel(slug, labels) }))]
  }, [messages, configuredCategories, labels])
  const filtered = useMemo(() => {
    const terms = normalizeSearch(prefs.search).split(/\s+/).filter(Boolean)
    const items = indexed.filter(({ item, text }) =>
      (prefs.type === 'all' || item.content_type === prefs.type) &&
      (!prefs.categories.length || prefs.categories.includes(item.category || 'geral')) &&
      (prefs.filter !== 'favorites' || item.is_favorite) &&
      (prefs.filter !== 'recent' || prefs.recent.includes(item.id)) &&
      terms.every(term => text.includes(term)),
    ).map(({ item }) => item)
    if (prefs.filter === 'recent') items.sort((a, b) => prefs.recent.indexOf(a.id) - prefs.recent.indexOf(b.id))
    return items
  }, [indexed, prefs.type, prefs.categories, prefs.filter, prefs.recent, prefs.search])

  useEffect(() => {
    if (listRef.current && visible) listRef.current.scrollTop = prefs.scrollTop
  }, [visible, loading, prefs.scrollTop])

  async function insert(item: MessageLibraryItem, caption = '') {
    const phone = context.chat?.phone
    if (!phone || (insertion.current && !insertion.current.signal.aborted)) return
    const version = generation.current
    const controller = new AbortController()
    insertion.current = controller
    setAction({ id: item.id, status: 'pending', message: item.content_type === 'text' ? 'Inserindo…' : 'Preparando arquivo…' })
    try {
      const resolved = resolveMessage(item.content ?? '', context)
      if (item.content_type === 'text') {
        await pasteTextIntoChat(resolved.content, phone, context.scope, controller.signal)
      } else if (item.file_url) {
        const url = await resolveLibraryMediaUrl(item.file_url, context.scope, item.id)
        controller.signal.throwIfAborted()
        setAction({ id: item.id, status: 'pending', message: 'Enviando…' })
        await sendMediaIntoChat(url, item.file_name || item.title, item.content_type, caption, phone, context.scope, controller.signal)
      } else throw new Error('Este modelo não tem um arquivo disponível.')
      if (version !== generation.current || currentPhone.current !== phone) return
      setPrefs({ recent: [item.id, ...prefs.recent.filter(id => id !== item.id)].slice(0, 30) })
      setAction({ id: item.id, status: 'done', message: item.content_type === 'text' ? 'Inserido. Revise e envie no WhatsApp.' : 'Mídia enviada ao WhatsApp.' })
      setReview(null)
    } catch (err) {
      if (version === generation.current) setAction({ id: item.id, status: 'error', message: err instanceof Error ? err.message : 'Não foi possível inserir.' })
    } finally { if (insertion.current === controller) insertion.current = null }
  }

  return <section className={`mc-panel${docked ? ' mc-panel-docked' : ''}`} aria-label="Central de Mensagens"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header className="mc-header">
      <div><BookOpenIcon size={15} /><strong>Central de Mensagens</strong><span className="mc-count">{filtered.length}</span></div>
      <button type="button" className="mc-icon-button" onClick={onClose} aria-label={docked ? 'Recolher Central' : 'Voltar ao contato'}><XIcon size={16} /></button>
    </header>
    <div className="mc-context" title={context.chat?.phone}>Para <strong>{context.contact?.name || context.chat?.name || context.chat?.phone || 'nenhuma conversa'}</strong></div>
    <div className="mc-tools">
      <div className="mc-search"><SearchIcon size={14} /><input ref={searchRef} aria-label="Buscar mensagens" placeholder="Buscar mensagem, categoria ou tag…"
        value={prefs.search} onChange={e => setPrefs({ search: e.target.value, scrollTop: 0 })} />
        {prefs.search && <button type="button" className="mc-icon-button" aria-label="Limpar busca" onClick={() => { setPrefs({ search: '', scrollTop: 0 }); searchRef.current?.focus() }}><XIcon size={12} /></button>}
      </div>
      {(!docked || prefs.type === 'all' || prefs.type === 'carousel') && <div className="mc-types" aria-label="Tipos de mensagem">{CENTER_TYPES.map(({ type, label }) => <button type="button" key={type}
        aria-pressed={prefs.type === type} onClick={() => setPrefs({ type, scrollTop: 0 })}>{label}</button>)}</div>}
      <div className="mc-filters">
        <div>{([{ value: 'all', label: 'Todas' }, { value: 'favorites', label: 'Favoritas' }, { value: 'recent', label: 'Recentes' }] as const).map(({ value, label }) =>
          <button type="button" key={value} aria-pressed={prefs.filter === value} onClick={() => setPrefs({ filter: value, scrollTop: 0 })}>{label}</button>)}</div>
      </div>
      <div className="mc-categories" aria-label="Filtrar por temas">
        {categories.map(category => <button type="button" key={category.slug} aria-pressed={prefs.categories.includes(category.slug)}
          onClick={() => setPrefs({ categories: prefs.categories.includes(category.slug) ? prefs.categories.filter(slug => slug !== category.slug) : [...prefs.categories, category.slug], scrollTop: 0 })}>{category.name}</button>)}
        {prefs.categories.length > 0 && <button type="button" className="mc-clear-categories" onClick={() => setPrefs({ categories: [], scrollTop: 0 })}>Limpar temas</button>}
      </div>
      {labelsError && <p className="mc-labels-error" role="status">{labelsError}</p>}
    </div>
    {error && <div className="mc-error" role="alert">{error} <button type="button" onClick={refetch}>Tentar novamente</button></div>}
    {loading && <Spinner label="Carregando mensagens…" />}
    <ul ref={listRef} className="mc-list" onScroll={e => { if (visible) setPrefs({ scrollTop: e.currentTarget.scrollTop }) }} aria-busy={loading}>
      {!loading && filtered.length === 0 && <li className="mc-empty">{messages.length ? 'Nenhuma mensagem com esses filtros.' : 'Nenhuma mensagem cadastrada.'}
        {messages.length > 0 && <button type="button" onClick={() => setPrefs({ search: '', categories: [], filter: 'all', type: 'all', scrollTop: 0 })}>Limpar filtros</button>}</li>}
      {filtered.map(item => {
        const resolved = resolveMessage(item.content ?? '', context)
        const itemAction = action?.id === item.id ? action : null
        const isExpanded = expanded === item.id
        const isText = item.content_type === 'text'
        return <li className="mc-item" key={item.id}>
          <div className="mc-item-top">
            <button type="button" className="mc-item-summary" aria-expanded={isExpanded} onClick={() => { setExpanded(isExpanded ? null : item.id); setReview(null) }}>
              <span className="mc-item-title">{item.is_favorite && <span className="mc-star" aria-label="Favorita">★ </span>}{item.title}</span>
              <span className="mc-item-excerpt">{isText ? resolved.content : item.file_name || resolved.content || 'Ver prévia'}</span>
            </button>
            {item.content_type !== 'carousel' && <button type="button" className="mc-insert" disabled={action?.status === 'pending' || !context.chat}
              onClick={() => {
                if (isText || item.content_type === 'audio') void insert(item)
                else { setExpanded(item.id); setReview({ id: item.id, caption: resolved.content }) }
              }}>{itemAction?.status === 'pending' ? 'Aguarde…' : isText ? 'Inserir' : item.content_type === 'audio' ? 'Enviar áudio' : 'Revisar envio'}</button>}
          </div>
          <div className="mc-item-meta"><span>{categoryLabel(item.category, labels)}</span><span>{CENTER_TYPES.find(type => type.type === item.content_type)?.label || item.content_type}</span>
            {!!item.use_count && <span>{item.use_count}× usado</span>}
            {resolved.missing.length > 0 && <span className="mc-missing">Variáveis sem valor</span>}
          </div>
          {isExpanded && <MessagePreview item={item} context={context} />}
          {itemAction && <p className={`mc-feedback mc-feedback-${itemAction.status}`} role={itemAction.status === 'error' ? 'alert' : 'status'}>{itemAction.message}</p>}
          {isExpanded && review?.id === item.id && <div className="mc-send-review">
            <label>Legenda<textarea aria-label="Legenda da mídia" value={review.caption} disabled={action?.status === 'pending'} onChange={event => setReview({ id: item.id, caption: event.target.value })} /></label>
            <div><button type="button" className="mc-insert" disabled={action?.status === 'pending' || !context.chat} onClick={() => void insert(item, review.caption)}>Confirmar envio</button>
              <button type="button" className="mc-icon-button" disabled={action?.status === 'pending'} onClick={() => setReview(null)}>Cancelar</button></div>
          </div>}
        </li>
      })}
    </ul>
    <footer className="mc-footer">
      <button type="button" onClick={refetch} disabled={refreshing || loading}>{refreshing ? 'Atualizando…' : 'Atualizar'}</button>
      <a href={`${VOE_API_BASE}/settings?nav=conversas&tab=central`} target="_blank" rel="noopener noreferrer">Gerenciar na Voe <ExternalLinkIcon size={12} /></a>
    </footer>
  </section>
}
