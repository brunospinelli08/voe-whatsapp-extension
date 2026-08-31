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
  // Sem isso, getUserMedia (gravação de áudio pra agendar mensagem) é
  // bloqueado por padrão dentro de um iframe cross-origin — mesmo sendo um
  // iframe da própria extensão, embutido numa página de terceiro
  // (web.whatsapp.com) ele ainda precisa da permissão delegada
  // explicitamente via Permissions Policy.
  iframe.allow = 'microphone'
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

// ── "Colar na conversa" (Central de Mensagens) ──────────────────────────
// Ponte no sentido oposto: sidebar (iframe) -> content.js -> DOM real do
// WhatsApp Web. A sidebar não tem acesso a esse DOM (é cross-origin), mas
// content.js sim — mesmo "mundo isolado" da extensão, DOM compartilhado com
// a página. Ver lib/pasteIntoChat.ts na sidebar pro lado que manda a
// mensagem e espera a resposta.
//
// Seletores da caixa de digitar em ordem de confiança — sem teste ao vivo
// contra a página real ainda, então mantém fallbacks: o WhatsApp Web já
// trocou os atributos internos várias vezes ao longo dos anos (é por isso
// que wa-js-bridge.js prefere os módulos internos do wa-js em vez de
// seletores de DOM sempre que dá — mas pra ACHAR a caixa de digitar não
// tem equivalente no wa-js, que é focado em dados, não em UI).
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

/**
 * Insere texto puro na caixa de digitar. execCommand tá deprecated na spec,
 * mas continua sendo o jeito mais confiável de escrever num contenteditable
 * de terceiro respeitando o próprio ciclo de eventos dele — dispara 'input',
 * que é o que editores baseados em React (o compositor do WhatsApp Web é um)
 * escutam pra sincronizar o estado interno. Mesma técnica usada por
 * extensões de resposta rápida pro WhatsApp Web em geral.
 */
function pasteTextIntoComposeBox(box, text) {
  box.focus()
  // Garante o cursor no FIM do que já estiver digitado (em vez de inserir
  // no meio de um texto parcial que o usuário já tivesse começado).
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(box)
  range.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.execCommand('insertText', false, text)
}

/**
 * "Cola" um arquivo (áudio/imagem/vídeo/documento) simulando um Ctrl+V de
 * verdade — diferente de texto, arquivo não dá pra inserir via execCommand.
 * O próprio handler de paste do WhatsApp Web já sabe reconhecer um arquivo
 * em clipboardData.files e abrir o preview de envio dele, o mesmo caminho
 * que um paste manual de imagem/documento usa.
 */
function pasteFileIntoComposeBox(box, file) {
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(file)
  box.focus()
  const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer })
  box.dispatchEvent(pasteEvent)
}

window.addEventListener('message', event => {
  if (event.data?.type !== 'VOE_PASTE_INTO_CHAT') return
  const { id, payload } = event.data
  const sidebarFrame = document.getElementById('voe-sidebar-frame')
  if (!sidebarFrame) return

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
})
