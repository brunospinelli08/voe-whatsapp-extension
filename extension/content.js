// content.js
// Roda no "mundo isolado" da extensão, dentro de web.whatsapp.com.
// Responsável por: detectar que o WhatsApp Web carregou, injetar a sidebar
// (iframe com o app da VOE), redimensionar o layout e gerenciar colapso.

const SIDEBAR_WIDTH = 340
const COLLAPSED_WIDTH = 36
const CENTER_BAR_HEIGHT = 36
const CENTER_BAR_GAP = 6
const CENTER_RESERVED_HEIGHT = CENTER_BAR_HEIGHT + CENTER_BAR_GAP

let lastReportedChat = null
let sidebarCollapsed = false
let extensionTheme = 'light'
let centerContext = null
let centerOpen = false
let chatRevision = 0
let centerLayoutPending = false
let observedFooter = null
let messageViewport = null
let messageViewportStyle = null
const centerResizeObserver = new ResizeObserver(() => scheduleCenterLayout())

// Tema próprio da extensão: nunca altera o tema da página do WhatsApp.
function applyExtensionTheme(value) {
  extensionTheme = value === 'dark' ? 'dark' : 'light'
  for (const id of ['voe-sidebar-toggle', 'voe-sidebar-frame', 'voe-message-center-frame']) {
    const element = document.getElementById(id)
    if (element) element.dataset.voeTheme = extensionTheme
  }
}

let themeChanged = false
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'voe-ext-theme' in changes) {
    themeChanged = true
    applyExtensionTheme(changes['voe-ext-theme'].newValue)
  }
})
chrome.storage.local.get('voe-ext-theme').then(stored => {
  if (!themeChanged) applyExtensionTheme(stored['voe-ext-theme'])
}).catch(() => {})

function isWhatsAppWebReady() {
  return (
    document.getElementById('app') !== null &&
    document.getElementsByClassName('app-wrapper-web').length > 0
  )
}

async function injectSidebar() {
  if (document.getElementById('voe-sidebar-frame')) return

  let sidebarUrl = chrome.runtime.getURL('sidebar/index.html')
  try {
    const stored = await chrome.storage.local.get('VOE_DEV_MODE')
    if (stored.VOE_DEV_MODE) {
      sidebarUrl = 'https://localhost:5173'
      console.info('[VOE Extension] Dev mode ativo — sidebar via localhost:5173')
    }
  } catch (_) { /* storage indisponível */ }

  // ── Iframe da sidebar ──
  const iframe = document.createElement('iframe')
  iframe.id = 'voe-sidebar-frame'
  iframe.src = sidebarUrl
  iframe.allow = 'microphone'
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${SIDEBAR_WIDTH}px;
    height: 100%;
    border: none;
    z-index: 9999;
    transition: width 0.2s ease, opacity 0.2s ease;
  `
  document.body.appendChild(iframe)

  const centerFrame = document.createElement('iframe')
  centerFrame.id = 'voe-message-center-frame'
  centerFrame.title = 'Central de Mensagens da Voe'
  centerFrame.src = `${sidebarUrl}?mode=message-center`
  centerFrame.hidden = true
  document.body.appendChild(centerFrame)
  const observer = new MutationObserver(scheduleCenterLayout)
  const appRoot = document.getElementById('app')
  if (appRoot) {
    observer.observe(appRoot, { childList: true, subtree: true })
    centerResizeObserver.observe(appRoot)
  }
  window.addEventListener('resize', scheduleCenterLayout)
  window.addEventListener('scroll', scheduleCenterLayout, true)

  // ── Botão de colapsar/expandir ──
  const toggleBtn = document.createElement('button')
  toggleBtn.id = 'voe-sidebar-toggle'
  toggleBtn.type = 'button'
  toggleBtn.title = 'Recolher painel VOE'
  toggleBtn.setAttribute('aria-label', toggleBtn.title)
  toggleBtn.setAttribute('aria-expanded', 'true')
  toggleBtn.setAttribute('aria-controls', iframe.id)
  toggleBtn.textContent = '›'
  toggleBtn.style.cssText = `
    position: fixed;
    top: 50%;
    right: ${SIDEBAR_WIDTH}px;
    transform: translateY(-50%);
    width: 20px;
    height: 48px;
    border-radius: 6px 0 0 6px;
    cursor: pointer;
    z-index: 10000;
    font-size: 14px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
  `
  toggleBtn.addEventListener('click', toggleSidebar)
  document.body.appendChild(toggleBtn)
  applyExtensionTheme(extensionTheme)

  // Abre espaço no layout do WhatsApp Web
  const appElement = document.getElementById('app')
  if (appElement) {
    appElement.style.width = `calc(100% - ${SIDEBAR_WIDTH}px)`
    appElement.style.maxWidth = '100%'
    appElement.style.transition = 'width 0.2s ease'
  }
}

function toggleSidebar() {
  const iframe = document.getElementById('voe-sidebar-frame')
  const toggleBtn = document.getElementById('voe-sidebar-toggle')
  const appElement = document.getElementById('app')
  if (!iframe || !toggleBtn) return

  sidebarCollapsed = !sidebarCollapsed

  if (sidebarCollapsed) {
    iframe.style.width = '0px'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    toggleBtn.style.right = '0px'
    toggleBtn.textContent = '‹'
    toggleBtn.title = 'Expandir painel VOE'
    toggleBtn.style.borderRadius = '6px 0 0 6px'
    if (appElement) appElement.style.width = 'calc(100% - 20px)'
  } else {
    iframe.style.width = `${SIDEBAR_WIDTH}px`
    iframe.style.opacity = '1'
    iframe.style.pointerEvents = 'auto'
    toggleBtn.style.right = `${SIDEBAR_WIDTH}px`
    toggleBtn.textContent = '›'
    toggleBtn.title = 'Recolher painel VOE'
    if (appElement) appElement.style.width = `calc(100% - ${SIDEBAR_WIDTH}px)`
  }
  toggleBtn.setAttribute('aria-label', toggleBtn.title)
  toggleBtn.setAttribute('aria-expanded', String(!sidebarCollapsed))
  scheduleCenterLayout()
}

function restoreMessageViewport() {
  if (messageViewport && messageViewportStyle) {
    const { value, priority } = messageViewportStyle
    if (value) messageViewport.style.setProperty('padding-bottom', value, priority)
    else messageViewport.style.removeProperty('padding-bottom')
  }
  messageViewport = null
  messageViewportStyle = null
}

// Alguns layouts do WhatsApp posicionam o histórico independentemente do
// footer. Compensa apenas a sobreposição
// real no elemento que rola, sem forçar quem está lendo mensagens antigas ao fim.
function reserveMessageSpace(footer, barTop) {
  const main = footer.closest('#main')
  if (!main) return
  if (!messageViewport?.isConnected || !main.contains(messageViewport)) {
    restoreMessageViewport()
    let bestArea = 0
    for (const element of main.querySelectorAll('div')) {
      if (footer.contains(element) || element.contains(footer)) continue
      if (element.clientHeight < 80 || element.clientWidth < main.clientWidth / 2) continue
      if (!/^(auto|scroll)$/.test(getComputedStyle(element).overflowY)) continue
      const area = element.clientWidth * element.clientHeight
      if (area > bestArea) { messageViewport = element; bestArea = area }
    }
    if (!messageViewport) return
    messageViewportStyle = {
      value: messageViewport.style.getPropertyValue('padding-bottom'),
      priority: messageViewport.style.getPropertyPriority('padding-bottom'),
      base: parseFloat(getComputedStyle(messageViewport).paddingBottom) || 0,
      reserved: 0,
    }
    centerResizeObserver.observe(messageViewport)
  }
  const rect = messageViewport.getBoundingClientRect()
  const overlap = Math.max(0, Math.ceil(rect.bottom - barTop))
  if (overlap === messageViewportStyle.reserved) return
  const pinned = messageViewport.scrollHeight - messageViewport.clientHeight - messageViewport.scrollTop <= 48
  const scrollTop = messageViewport.scrollTop
  messageViewport.style.setProperty('padding-bottom', `${messageViewportStyle.base + overlap}px`, 'important')
  messageViewportStyle.reserved = overlap
  if (pinned) messageViewport.scrollTop = messageViewport.scrollHeight
  else messageViewport.scrollTop = scrollTop
}

// Reserva somente no histórico: inserir irmãos no flex do WhatsApp pode criar
// uma faixa sob o cabeçalho devido à propriedade order dos elementos nativos.
// O painel expandido continua sobre a conversa, com altura limitada.
function scheduleCenterLayout() {
  if (centerLayoutPending) return
  centerLayoutPending = true
  requestAnimationFrame(() => {
    centerLayoutPending = false
    const frame = document.getElementById('voe-message-center-frame')
    if (!frame) return
    const box = findComposeBox()
    const footer = box?.closest('footer')
    const usable = centerContext && lastReportedChat?.phone && footer && footer.getClientRects().length
    if (!usable) {
      frame.hidden = true
      restoreMessageViewport()
      return
    }
    if (observedFooter !== footer) {
      centerResizeObserver.disconnect()
      centerResizeObserver.observe(footer)
      if (footer.parentElement) centerResizeObserver.observe(footer.parentElement)
      if (messageViewport?.isConnected) centerResizeObserver.observe(messageViewport)
      observedFooter = footer
    }
    const rect = footer.getBoundingClientRect()
    // Alinha a cápsula com a superfície arredondada que contém a digitação,
    // incluindo seus botões. Sem superfície identificável, usa o recuo do footer.
    let composerRect = null
    for (let element = box; element && element !== footer; element = element.parentElement) {
      const bounds = element.getBoundingClientRect()
      if (bounds.width >= rect.width / 2 && parseFloat(getComputedStyle(element).borderTopLeftRadius) >= 16) composerRect = bounds
    }
    const footerStyle = getComputedStyle(footer)
    const leftInset = composerRect ? Math.max(0, composerRect.left - rect.left) : Math.max(12, parseFloat(footerStyle.paddingLeft) || 0)
    const rightInset = composerRect ? Math.max(0, rect.right - composerRect.right) : Math.max(12, parseFloat(footerStyle.paddingRight) || 0)
    const bottom = rect.top - CENTER_BAR_GAP
    const main = footer.closest('#main')
    const chatHeader = main?.querySelector(':scope > header')
    const upperBoundary = Math.max(64, (chatHeader?.getBoundingClientRect().bottom ?? 56) + 8)
    const available = Math.max(CENTER_BAR_HEIGHT, bottom - upperBoundary)
    const height = centerOpen ? Math.min(450, available) : CENTER_BAR_HEIGHT
    frame.hidden = rect.width < 260 || bottom - upperBoundary < CENTER_BAR_HEIGHT
    frame.style.left = `${rect.left + leftInset}px`
    frame.style.top = `${bottom - height}px`
    frame.style.width = `${Math.max(0, rect.width - leftInset - rightInset)}px`
    frame.style.height = `${height}px`
    if (frame.hidden) restoreMessageViewport()
    else reserveMessageSpace(footer, rect.top - CENTER_RESERVED_HEIGHT)
  })
}

function loadStylesheetOverrides() {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL('extension/wa-overrides.css')
  document.head.appendChild(link)
}

function loadWaJsBridge() {
  const waJsLib = document.createElement('script')
  waJsLib.src = chrome.runtime.getURL('extension/wppconnect-wa.js')
  waJsLib.onload = () => {
    const bridge = document.createElement('script')
    bridge.src = chrome.runtime.getURL('extension/wa-js-bridge.js')
    document.body.appendChild(bridge)
  }
  document.body.appendChild(waJsLib)
}

function waitForWhatsAppWeb() {
  if (isWhatsAppWebReady()) {
    injectSidebar()
    loadStylesheetOverrides()
    loadWaJsBridge()
    return
  }
  setTimeout(waitForWhatsAppWeb, 200)
}

waitForWhatsAppWeb()

// ── Ponte: página real -> content script -> sidebar (iframe) ──
document.addEventListener('VOE_WHATSAPP_EVENT', event => {
  if (lastReportedChat?.phone !== event.detail?.phone) {
    chatRevision++
    centerOpen = false
    document.getElementById('voe-message-center-frame')?.contentWindow.postMessage({ type: 'VOE_CENTER_CLOSE' }, '*')
    if (centerContext) {
      centerContext = { ...centerContext, chat: event.detail ?? null, contact: null }
      document.getElementById('voe-message-center-frame')?.contentWindow.postMessage({ type: 'VOE_CENTER_CONTEXT', context: centerContext }, '*')
    }
  }
  lastReportedChat = event.detail
  scheduleCenterLayout()
  const sidebarFrame = document.getElementById('voe-sidebar-frame')
  if (sidebarFrame) {
    sidebarFrame.contentWindow.postMessage(
      { type: 'WHATSAPP_EVENT', payload: event.detail },
      '*',
    )
  }
})

// ── Handshake: sidebar pede o chat ativo atual ao inicializar ──
// wa-js-bridge escuta VOE_REQUEST_ACTIVE_CHAT e responde com o chat atual
// via VOE_WHATSAPP_EVENT. Mas o bridge roda no contexto real da página,
// não escuta postMessage do iframe — então o content.js faz a ponte:
// recebe o pedido do iframe e dispara um CustomEvent pro bridge.
//
// Também responde com o lastReportedChat se já tiver (o bridge pode ainda
// não ter respondido, mas o content.js já tem o último evento guardado).

// ── Ponte sidebar -> content.js ──────────────────────────────────────────
const COMPOSE_BOX_SELECTORS = [
  '[data-testid="conversation-compose-box-input"]',
  'footer [contenteditable="true"][data-tab]',
  '#main footer div[contenteditable="true"]',
  'div[contenteditable="true"][data-tab="10"]',
]

function findComposeBox() {
  for (const selector of COMPOSE_BOX_SELECTORS) {
    const el = document.querySelector(selector)
    if (el && el.getClientRects().length && el.closest('#main') && el.getAttribute('contenteditable') === 'true') return el
  }
  return null
}

function pasteTextIntoComposeBox(box, text) {
  const before = box.innerText
  box.focus()
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(box)
  range.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(range)
  const inserted = document.execCommand('insertText', false, `${before && !/\s$/.test(before) ? '\n' : ''}${text}`)
  if (!inserted || box.innerText === before) throw new Error('O WhatsApp não confirmou a inserção do texto. Tente novamente.')
}

function readActiveChat() {
  return new Promise((resolve, reject) => {
    const id = `verify-${Date.now()}-${Math.random()}`
    const timeout = setTimeout(() => {
      document.removeEventListener('VOE_VERIFIED_CHAT', handler)
      reject(new Error('Não foi possível confirmar a conversa ativa. Aguarde e tente novamente.'))
    }, 2500)
    function handler(event) {
      if (event.detail?.id !== id) return
      clearTimeout(timeout)
      document.removeEventListener('VOE_VERIFIED_CHAT', handler)
      resolve(event.detail.phone ?? null)
    }
    document.addEventListener('VOE_VERIFIED_CHAT', handler)
    document.dispatchEvent(new CustomEvent('VOE_VERIFY_ACTIVE_CHAT', { detail: { id } }))
  })
}

function sendMediaThroughBridge(payload) {
  return new Promise((resolve, reject) => {
    const id = `media-${Date.now()}-${Math.random()}`
    const timeout = setTimeout(() => {
      document.removeEventListener('VOE_MEDIA_SENT', handler)
      reject(new Error('Envio sem confirmação. Confira a conversa antes de tentar novamente.'))
    }, 90000)
    function handler(event) {
      if (event.detail?.id !== id) return
      clearTimeout(timeout)
      document.removeEventListener('VOE_MEDIA_SENT', handler)
      if (event.detail.ok) resolve(event.detail)
      else reject(new Error(event.detail.error))
    }
    document.addEventListener('VOE_MEDIA_SENT', handler)
    document.dispatchEvent(new CustomEvent('VOE_SEND_MEDIA', { detail: { ...payload, id } }))
  })
}

let insertionPending = false
window.addEventListener('message', async event => {
  const sidebarFrame = document.getElementById('voe-sidebar-frame')
  const centerFrame = document.getElementById('voe-message-center-frame')
  if (!sidebarFrame || (event.source !== sidebarFrame.contentWindow && event.source !== centerFrame?.contentWindow)) return
  const source = event.source
  const replyToSource = data => source.postMessage(data, event.origin)

  if (event.data?.type === 'VOE_CENTER_CONTEXT' && source === sidebarFrame.contentWindow) {
    const next = event.data.context
    if (centerContext?.scope?.workspaceId !== next?.scope?.workspaceId || centerContext?.scope?.userId !== next?.scope?.userId) {
      centerOpen = false
      document.dispatchEvent(new CustomEvent('VOE_CANCEL_MEDIA_PREPARATION'))
    }
    centerContext = next
    centerFrame?.contentWindow.postMessage({ type: 'VOE_CENTER_CONTEXT', context: next }, '*')
    scheduleCenterLayout()
    return
  }
  if (event.data?.type === 'VOE_CENTER_READY' && source === centerFrame?.contentWindow) {
    replyToSource({ type: 'VOE_CENTER_CONTEXT', context: centerContext })
    sidebarFrame.contentWindow.postMessage({ type: 'VOE_REQUEST_CENTER_CONTEXT' }, '*')
    return
  }
  if (event.data?.type === 'VOE_CENTER_SIZE' && source === centerFrame?.contentWindow) {
    centerOpen = !!event.data.open
    scheduleCenterLayout()
    return
  }

  // ── Handshake: sidebar pede o chat ativo ──
  if (event.data?.type === 'VOE_REQUEST_ACTIVE_CHAT') {
    // Responde imediatamente com o que já temos
    if (lastReportedChat) {
      sidebarFrame.contentWindow.postMessage(
        { type: 'WHATSAPP_EVENT', payload: lastReportedChat },
        '*',
      )
    }
    // Também pede pro bridge resolver o chat atual (pode ter mudado)
    document.dispatchEvent(new CustomEvent('VOE_REQUEST_ACTIVE_CHAT'))
    return
  }

  // ── "Colar na conversa" ──
  if (event.data?.type === 'VOE_PASTE_INTO_CHAT') {
    const { id, payload } = event.data

    function reply(ok, error, confirmed = false) {
      replyToSource({ type: 'VOE_PASTE_RESULT', id, ok, error, confirmed })
    }
    if (insertionPending) {
      reply(false, 'Aguarde a inserção anterior terminar.')
      return
    }
    insertionPending = true
    try {
      const revision = chatRevision
      const phone = await readActiveChat()
      if (!payload?.expectedPhone || phone !== payload.expectedPhone || revision !== chatRevision || payload.revision !== chatRevision) {
        throw new Error('A conversa mudou. Volte ao contato correto e tente novamente.')
      }
      if (payload.scope && (payload.scope.workspaceId !== centerContext?.scope.workspaceId || payload.scope.userId !== centerContext?.scope.userId)) {
        throw new Error('O workspace mudou. Abra a Central novamente.')
      }
      const box = findComposeBox()
      if (!box) throw new Error('Abra uma conversa no WhatsApp Web antes de inserir.')
      if (payload?.kind === 'text') {
        pasteTextIntoComposeBox(box, payload.text)
      } else if (payload?.kind === 'file') {
        await sendMediaThroughBridge(payload)
      } else {
        reply(false, 'Tipo de conteúdo desconhecido.')
        return
      }
      reply(true, undefined, true)
    } catch (err) {
      reply(false, err instanceof Error ? err.message : String(err))
    } finally { insertionPending = false }
    return
  }

  // ── Consulta do chat ativo (verificação antes de colar mídia) ──
  if (event.data?.type === 'VOE_GET_CURRENT_CHAT') {
    const revision = chatRevision
    try {
      const phone = await readActiveChat()
      replyToSource({ type: 'VOE_CURRENT_CHAT_RESULT', id: event.data.id, phone: revision === chatRevision ? phone : null, revision })
    } catch {
      replyToSource({ type: 'VOE_CURRENT_CHAT_RESULT', id: event.data.id, phone: null, revision })
    }
    return
  }
})
