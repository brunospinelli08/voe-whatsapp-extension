// content.js
// Roda no "mundo isolado" da extensão, dentro de web.whatsapp.com.
// Responsável por: detectar que o WhatsApp Web carregou, injetar a sidebar
// (iframe com o app da VOE), redimensionar o layout e gerenciar colapso.

const SIDEBAR_WIDTH = 340
const COLLAPSED_WIDTH = 36

let lastReportedChat = null
let sidebarCollapsed = false

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
    background: hsl(228, 33%, 97%);
    z-index: 9999;
    transition: width 0.2s ease, opacity 0.2s ease;
  `
  document.body.appendChild(iframe)

  // ── Botão de colapsar/expandir ──
  const toggleBtn = document.createElement('button')
  toggleBtn.id = 'voe-sidebar-toggle'
  toggleBtn.title = 'Recolher painel VOE'
  toggleBtn.innerHTML = '‹'
  toggleBtn.style.cssText = `
    position: fixed;
    top: 50%;
    right: ${SIDEBAR_WIDTH}px;
    transform: translateY(-50%);
    width: 20px;
    height: 48px;
    background: hsl(175, 100%, 39%);
    color: white;
    border: none;
    border-radius: 6px 0 0 6px;
    cursor: pointer;
    z-index: 10000;
    font-size: 14px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: right 0.2s ease;
    box-shadow: -2px 0 6px rgba(0,0,0,0.15);
  `
  toggleBtn.addEventListener('click', toggleSidebar)
  document.body.appendChild(toggleBtn)

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
    toggleBtn.innerHTML = '›'
    toggleBtn.title = 'Expandir painel VOE'
    toggleBtn.style.borderRadius = '6px 0 0 6px'
    if (appElement) appElement.style.width = 'calc(100% - 20px)'
  } else {
    iframe.style.width = `${SIDEBAR_WIDTH}px`
    iframe.style.opacity = '1'
    iframe.style.pointerEvents = 'auto'
    toggleBtn.style.right = `${SIDEBAR_WIDTH}px`
    toggleBtn.innerHTML = '‹'
    toggleBtn.title = 'Recolher painel VOE'
    if (appElement) appElement.style.width = `calc(100% - ${SIDEBAR_WIDTH}px)`
  }
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
  lastReportedChat = event.detail
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
    if (el) return el
  }
  return null
}

function base64ToFile(base64, fileName, mimeType) {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new File([bytes], fileName, { type: mimeType })
}

function pasteTextIntoComposeBox(box, text) {
  box.focus()
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(box)
  range.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.execCommand('insertText', false, text)
}

function pasteFileIntoComposeBox(box, file) {
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(file)
  box.focus()
  const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer })
  box.dispatchEvent(pasteEvent)
}

window.addEventListener('message', event => {
  const sidebarFrame = document.getElementById('voe-sidebar-frame')
  if (!sidebarFrame) return

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

    function reply(ok, error) {
      sidebarFrame.contentWindow.postMessage({ type: 'VOE_PASTE_RESULT', id, ok, error }, '*')
    }

    const box = findComposeBox()
    if (!box) {
      reply(false, 'Abra uma conversa no WhatsApp Web antes de colar.')
      return
    }

    try {
      if (payload?.kind === 'text') {
        pasteTextIntoComposeBox(box, payload.text)
      } else if (payload?.kind === 'file') {
        const file = base64ToFile(payload.base64, payload.fileName, payload.mimeType)
        pasteFileIntoComposeBox(box, file)
      } else {
        reply(false, 'Tipo de conteúdo desconhecido.')
        return
      }
      reply(true)
    } catch (err) {
      reply(false, err instanceof Error ? err.message : String(err))
    }
    return
  }

  // ── Consulta do chat ativo (verificação antes de colar mídia) ──
  if (event.data?.type === 'VOE_GET_CURRENT_CHAT') {
    sidebarFrame.contentWindow.postMessage({
      type: 'VOE_CURRENT_CHAT_RESULT',
      id: event.data.id,
      phone: lastReportedChat?.phone ?? null,
    }, '*')
    return
  }
})
