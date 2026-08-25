// content.js
// Roda no "mundo isolado" da extensão, dentro de web.whatsapp.com.
// Responsável por: detectar que o WhatsApp Web carregou, injetar a sidebar
// (iframe com o app da VOE) e redimensionar o layout pra abrir espaço.

const SIDEBAR_WIDTH = 340

function isWhatsAppWebReady() {
  return (
    document.getElementById('app') !== null &&
    document.getElementsByClassName('app-wrapper-web').length > 0
  )
}

function injectSidebar() {
  if (document.getElementById('voe-sidebar-frame')) return // já injetado

  const iframe = document.createElement('iframe')
  iframe.id = 'voe-sidebar-frame'
  iframe.src = chrome.runtime.getURL('sidebar/index.html')
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${SIDEBAR_WIDTH}px;
    height: 100%;
    border: none;
    z-index: 9999;
  `
  document.body.appendChild(iframe)

  // Abre espaço no layout do WhatsApp Web pra sidebar não sobrepor a conversa
  const appElement = document.getElementById('app')
  if (appElement) {
    appElement.style.width = `calc(100% - ${SIDEBAR_WIDTH}px)`
    appElement.style.maxWidth = '100%'
  }
}

function loadStylesheetOverrides() {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL('extension/wa-overrides.css')
  document.head.appendChild(link)
}

function loadWaJsBridge() {
  // Injeta o script no contexto REAL da página (não no mundo isolado da extensão).
  // É assim que conseguimos acessar os módulos internos do WhatsApp Web.
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('extension/wa-js-bridge.js')
  document.body.appendChild(script)
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

// Ponte de eventos: página real -> content script -> sidebar (iframe)
// TODO: quando o wa-js estiver integrado (Passo 4), escutar aqui o evento
// customizado disparado pelo wa-js-bridge.js com o telefone do chat ativo,
// e repassar pro iframe via postMessage.
document.addEventListener('VOE_WHATSAPP_EVENT', event => {
  const sidebarFrame = document.getElementById('voe-sidebar-frame')
  if (sidebarFrame) {
    sidebarFrame.contentWindow.postMessage(
      { type: 'WHATSAPP_EVENT', payload: event.detail },
      '*',
    )
  }
})
