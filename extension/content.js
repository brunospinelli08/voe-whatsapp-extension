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
  // Injeta os scripts no contexto REAL da página (não no mundo isolado da
  // extensão). É assim que conseguimos acessar os módulos internos do
  // WhatsApp Web. A ordem importa: a lib wa-js precisa estar carregada e
  // executada ANTES do bridge, então encadeamos via onload em vez de
  // simplesmente inserir os dois scripts em sequência (scripts injetados
  // dinamicamente são async por padrão e podem executar fora de ordem).
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

// Ponte de eventos: página real -> content script -> sidebar (iframe)
// wa-js-bridge.js dispara este evento sempre que o chat ativo muda,
// com { phone, name } do contato (ou null, se nenhum chat individual
// estiver ativo). Aqui só repassamos pro iframe via postMessage.
document.addEventListener('VOE_WHATSAPP_EVENT', event => {
  const sidebarFrame = document.getElementById('voe-sidebar-frame')
  if (sidebarFrame) {
    sidebarFrame.contentWindow.postMessage(
      { type: 'WHATSAPP_EVENT', payload: event.detail },
      '*',
    )
  }
})
