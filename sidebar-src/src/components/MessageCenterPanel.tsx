// MessageCenterPanel.tsx
// Central de Mensagens — espelha a Central de Mensagens real
// (ChatMessageCenterBar.tsx + ChatMessageCenterPanel.tsx, aba WhatsApp da
// oportunidade em app.voeops.com): abas por tipo (Texto, Áudio, Imagem,
// Vídeo, Documento, Carrossel) e uma lista com os modelos cadastrados do
// tipo escolhido. Pedido explícito do Bruno, com diferenças conscientes:
//
// 1. Tela cheia, não painel embutido (3ª rodada — a versão anterior abria
//    um bloco dentro do painel de Contexto/Atividades; achado feio e
//    apertado). `MessageCenterToggle` é só o botão de entrada (renderizado
//    por LeadPanel.tsx no lugar de sempre); `MessageCenterScreen` é a tela
//    cheia de verdade, que LeadPanel.tsx renderiza SOZINHA — sem header de
//    contato, sem abas Contexto/Atividades — com "← Voltar" pra sair
//    (mesmo padrão de TemplatePickerInline.tsx/CreateTemplateScreen.tsx).
// 2. Aba extra "Todos" (o real não tem — só abre por tipo), selecionada
//    por padrão ao abrir a tela. Mistura os 6 tipos numa lista só, cada
//    item com um selo do próprio tipo pra não ficar ambíguo.
// 3. "Inserir" (só texto no real) virou "Colar na conversa" pra TODOS os
//    tipos, inclusive mídia — ver pasteIntoChat.ts. No real, mídia só tem
//    "Enviar" (manda de verdade via canal do backend); aqui não existe
//    canal de backend equivalente à sessão de WhatsApp Web do próprio
//    usuário, e "enviar" automático não foi pedido — então "colar" preenche
//    a caixa de digitar (texto) ou abre o preview de mídia do próprio
//    WhatsApp (arquivo), sempre deixando o clique final de enviar com o
//    usuário. Carrossel é a única exceção: não dá pra "colar" um carrossel
//    numa caixa de texto (é um formato interativo da Cloud API, sem
//    equivalente manual) — aparece só pra consulta, com o mesmo aviso do
//    real sobre precisar do dashboard.
// 4. Sem categorias/tags/"modelos" (coleções) do real — a extensão não tem
//    esses endpoints ainda. Só busca por título/conteúdo.
//
// "Criar modelo" (pedido explícito) não abre um formulário aqui dentro —
// vai direto pra VOE, na tela de Configurações → Conversas → Central de
// Mensagens (deep link via ?nav=conversas&tab=central, adicionado em
// app.voeops.com nesta rodada especificamente pra isso). Cadastrar modelo
// já tem uma tela completa lá (upload de mídia, carrossel, categorias) —
// replicar tudo de novo aqui duplicaria manutenção pra um fluxo que não é
// o cotidiano (cadastra uma vez, usa muitas).

import { useMemo, useState } from 'react'
import { useMessageLibrary, type MessageLibraryItem } from '../hooks/useMessageLibrary'
import { pasteTextIntoChat, pasteMediaIntoChat } from '../lib/pasteIntoChat'
import { VOE_API_BASE } from '../config'
import { Spinner } from './Spinner'
import {
  MessageCircleIcon, MicIcon, ImageIcon, VideoIcon, FileTextIcon, LayoutGridIcon,
  LayersIcon, SearchIcon, XIcon, ClipboardIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon,
  BookOpenIcon, ExternalLinkIcon,
} from './Icons'

type CenterType = 'all' | 'text' | 'audio' | 'image' | 'video' | 'document' | 'carousel'

const TABS: { type: CenterType; label: string; icon: typeof MessageCircleIcon }[] = [
  { type: 'all', label: 'Todos', icon: LayersIcon },
  { type: 'text', label: 'Texto', icon: MessageCircleIcon },
  { type: 'audio', label: 'Áudio', icon: MicIcon },
  { type: 'image', label: 'Imagem', icon: ImageIcon },
  { type: 'video', label: 'Vídeo', icon: VideoIcon },
  { type: 'document', label: 'Documento', icon: FileTextIcon },
  { type: 'carousel', label: 'Carrossel', icon: LayoutGridIcon },
]

const TYPE_ICONS: Record<string, typeof MessageCircleIcon> = {
  text: MessageCircleIcon,
  audio: MicIcon,
  image: ImageIcon,
  video: VideoIcon,
  document: FileTextIcon,
  carousel: LayoutGridIcon,
}

const TYPE_LABELS: Record<CenterType, string> = {
  all: 'Todos',
  text: 'Texto',
  audio: 'Áudio',
  image: 'Imagem',
  video: 'Vídeo',
  document: 'Documento',
  carousel: 'Carrossel',
}

type PasteState = 'idle' | 'pasting' | 'done' | 'error'

/** Botão de entrada — renderizado por LeadPanel.tsx no lugar de onde a
 * Central de Mensagens costumava abrir embutida. */
export function MessageCenterToggle({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="msg-center-toggle" onClick={onClick}>
      <span className="msg-center-toggle-icon"><BookOpenIcon size={14} /></span>
      Central de Mensagens
      <ChevronRightIcon size={13} className="msg-center-toggle-chevron" />
    </button>
  )
}

interface ItemCardProps {
  item: MessageLibraryItem
  showTypeBadge: boolean
  pasteState: PasteState
  pasteError: string | null
  onPaste: () => void
}

function ItemCard({ item, showTypeBadge, pasteState, pasteError, onPaste }: ItemCardProps) {
  const Icon = TYPE_ICONS[item.content_type]
  const isText = item.content_type === 'text'
  const isCarousel = item.content_type === 'carousel'
  const isMedia = !isText && !isCarousel

  return (
    <li className="msg-center-item">
      {isText && (
        <>
          <div className="msg-center-item-title-row">
            {item.is_favorite && <span className="message-library-fav">★</span>}
            <span className="msg-center-item-title">{item.title}</span>
            {showTypeBadge && Icon && <span className="msg-center-type-badge"><Icon size={10} /></span>}
          </div>
          {item.content && <p className="msg-center-item-preview">{item.content}</p>}
        </>
      )}

      {isMedia && (
        <div className="msg-center-media-row">
          <div className="msg-center-thumb">
            {item.content_type === 'image' && item.file_url ? (
              <img src={item.file_url} alt={item.title} />
            ) : item.content_type === 'video' && item.file_url ? (
              <video src={item.file_url} muted />
            ) : (
              Icon && <Icon size={16} />
            )}
          </div>
          <div className="msg-center-media-info">
            <div className="msg-center-item-title-row">
              {item.is_favorite && <span className="message-library-fav">★</span>}
              <span className="msg-center-item-title">{item.title}</span>
              {showTypeBadge && Icon && <span className="msg-center-type-badge"><Icon size={10} /></span>}
            </div>
            {item.file_name && <p className="msg-center-item-preview">{item.file_name}</p>}
          </div>
        </div>
      )}

      {isCarousel && (
        <>
          <div className="msg-center-item-title-row">
            {item.is_favorite && <span className="message-library-fav">★</span>}
            <span className="msg-center-item-title">{item.title}</span>
          </div>
          {item.carousel_cards && item.carousel_cards.length > 0 && (
            <div className="msg-center-carousel-strip">
              {item.carousel_cards.slice(0, 6).map((card, i) => (
                <div key={i} className="msg-center-carousel-card">
                  {card.header_type === 'image' ? (
                    <img src={card.header_url} alt={`Card ${i + 1}`} />
                  ) : (
                    <video src={card.header_url} muted />
                  )}
                </div>
              ))}
              {item.carousel_cards.length > 6 && (
                <div className="msg-center-carousel-more">+{item.carousel_cards.length - 6}</div>
              )}
            </div>
          )}
        </>
      )}

      <div className="msg-center-item-footer">
        <span className="msg-center-category">{item.category ?? 'geral'}</span>
        {isCarousel ? (
          <span className="msg-center-carousel-hint">Envie pelo dashboard</span>
        ) : (
          <button
            type="button"
            className={`msg-center-paste-btn${pasteState === 'done' ? ' is-done' : ''}`}
            disabled={pasteState === 'pasting'}
            onClick={onPaste}
          >
            <ClipboardIcon size={10} />
            {pasteState === 'pasting' ? 'Colando…' : pasteState === 'done' ? 'Colado!' : 'Colar na conversa'}
          </button>
        )}
      </div>
      {pasteState === 'error' && pasteError && <p className="error-text">{pasteError}</p>}
    </li>
  )
}

interface ScreenProps {
  /** Nome/telefone do chat ativo — só pra deixar claro pra qual conversa o
   * "colar" vai, evitando confundir num dia com várias abas abertas. */
  chatName: string | null
  chatPhone: string
  onClose: () => void
}

export function MessageCenterScreen({ chatName, chatPhone, onClose }: ScreenProps) {
  const { messages, loading, error } = useMessageLibrary()
  const [activeType, setActiveType] = useState<CenterType>('all')
  const [search, setSearch] = useState('')
  const [pasteStates, setPasteStates] = useState<Record<string, { state: PasteState; error: string | null }>>({})

  const filteredItems = useMemo(() => {
    let list = activeType === 'all' ? messages : messages.filter(m => m.content_type === activeType)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(m => m.title.toLowerCase().includes(q) || (m.content ?? '').toLowerCase().includes(q))
    }
    return list
  }, [messages, activeType, search])

  const totalOfType = useMemo(
    () => (activeType === 'all' ? messages.length : messages.filter(m => m.content_type === activeType).length),
    [messages, activeType],
  )

  function selectTab(type: CenterType) {
    setActiveType(type)
    setSearch('')
  }

  async function handlePaste(item: MessageLibraryItem) {
    setPasteStates(prev => ({ ...prev, [item.id]: { state: 'pasting', error: null } }))
    try {
      if (item.content_type === 'text') {
        await pasteTextIntoChat(item.content)
      } else if (item.file_url) {
        await pasteMediaIntoChat(item.file_url, item.file_name ?? item.title)
      } else {
        throw new Error('Esse item não tem conteúdo pra colar.')
      }
      setPasteStates(prev => ({ ...prev, [item.id]: { state: 'done', error: null } }))
      setTimeout(() => {
        setPasteStates(prev => (prev[item.id]?.state === 'done' ? { ...prev, [item.id]: { state: 'idle', error: null } } : prev))
      }, 2500)
    } catch (err) {
      setPasteStates(prev => ({
        ...prev,
        [item.id]: { state: 'error', error: err instanceof Error ? err.message : 'Erro ao colar na conversa' },
      }))
    }
  }

  const typeLabel = TYPE_LABELS[activeType]

  return (
    <div className="msg-center-screen">
      <div className="template-picker-header">
        <button type="button" className="back-button" onClick={onClose}>
          <ChevronLeftIcon size={13} /> Voltar
        </button>
        <span>Central de Mensagens</span>
      </div>

      <p className="msg-center-context">
        <MessageCircleIcon size={11} /> Colando em <strong>{chatName || chatPhone}</strong>
      </p>

      <div className="msg-center-type-grid">
        {TABS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            className={`msg-center-type-btn${activeType === type ? ' is-active' : ''}`}
            onClick={() => selectTab(type)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <a
        href={`${VOE_API_BASE}/settings?nav=conversas&tab=central`}
        target="_blank"
        rel="noopener noreferrer"
        className="msg-center-create-cta"
      >
        <PlusIcon size={11} />
        Criar modelo novo na VOE
        <ExternalLinkIcon size={11} className="msg-center-create-cta-arrow" />
      </a>

      <p className="msg-center-drawer-count">
        {typeLabel} · {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'itens'}
      </p>

      <div className="message-library-search">
        <SearchIcon size={11} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar ${typeLabel.toLowerCase()}…`}
          autoFocus
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca">
            <XIcon size={10} />
          </button>
        )}
      </div>

      {loading && <Spinner label="Carregando…" />}

      {error && (
        <div className="error-banner">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <p className="muted msg-center-empty">
          {totalOfType === 0
            ? `Nada cadastrado ainda em ${typeLabel.toLowerCase()}.`
            : 'Nenhum resultado para essa busca.'}
        </p>
      )}

      {!loading && filteredItems.length > 0 && (
        <ul className="msg-center-list">
          {filteredItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              showTypeBadge={activeType === 'all'}
              pasteState={pasteStates[item.id]?.state ?? 'idle'}
              pasteError={pasteStates[item.id]?.error ?? null}
              onPaste={() => handlePaste(item)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
