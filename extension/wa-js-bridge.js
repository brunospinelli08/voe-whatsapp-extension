// wa-js-bridge.js
// Roda no CONTEXTO REAL da página do WhatsApp Web.
// Detecta o chat ativo e dispara VOE_WHATSAPP_EVENT.

let chatSeq = 0

function waitForWppReady() {
  if (typeof WPP === 'undefined' || !WPP.isFullReady) {
    setTimeout(waitForWppReady, 200)
    return
  }
  onWppReady()
}

function onWppReady() {
  console.log('[VOE Extension] wa-js pronto (WPP.isFullReady) — escutando chat.active_chat')

  // Escuta mudanças de chat
  WPP.on('chat.active_chat', async chat => {
    const seq = ++chatSeq
    dispatchChatEvent(null)
    const result = await resolveActiveChat(chat)
    if (seq !== chatSeq) return
    dispatchChatEvent(result)
  })

  // Handshake: sidebar pede o chat atual ao inicializar.
  // content.js repassa como CustomEvent VOE_REQUEST_ACTIVE_CHAT.
  document.addEventListener('VOE_REQUEST_ACTIVE_CHAT', async () => {
    try {
      const activeChat = WPP.chat.getActiveChat()
      if (activeChat) {
        const result = await resolveActiveChat(activeChat)
        dispatchChatEvent(result)
      }
    } catch (err) {
      console.warn('[VOE Extension] Erro ao resolver chat ativo no handshake:', err)
    }
  })

  // Dispara o chat atual logo que o bridge fica pronto (caso a sidebar
  // já esteja carregada esperando)
  try {
    const activeChat = WPP.chat.getActiveChat()
    if (activeChat) {
      resolveActiveChat(activeChat).then(result => {
        if (chatSeq === 0) dispatchChatEvent(result)
      })
    }
  } catch (_) { /* nenhum chat aberto ainda */ }
}

async function resolveActiveChat(chat) {
  if (!chat || chat.isGroup) {
    return null
  }

  const isLid = typeof chat.id?.isLid === 'function' ? chat.id.isLid() : chat.id?.server === 'lid'

  let contact = null
  try {
    contact = await WPP.contact.get(chat.id)
  } catch (err) {
    console.warn('[VOE Extension] Não foi possível buscar detalhes do contato:', err)
  }

  let phoneWid = chat.id
  if (isLid) {
    const resolved = contact?.pnForLid ?? null
    if (resolved) {
      phoneWid = resolved
    } else {
      console.warn('[VOE Extension] Chat com ID @lid sem telefone resolvido:', chat.id?.toString?.() ?? chat.id)
      return null
    }
  }

  const phone = phoneWid?.user ?? (typeof phoneWid === 'string' ? phoneWid : null)
  if (!phone) return null

  let name = chat.formattedTitle || chat.name || null
  name = contact?.name || contact?.formattedName || contact?.pushname || name

  return { phone, name }
}

function dispatchChatEvent(detail) {
  document.dispatchEvent(new CustomEvent('VOE_WHATSAPP_EVENT', { detail }))
}

waitForWppReady()
