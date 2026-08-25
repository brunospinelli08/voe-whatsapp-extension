// wa-js-bridge.js
// Este arquivo roda no CONTEXTO REAL da página do WhatsApp Web (não no
// mundo isolado da extensão) — é o único jeito de acessar os módulos
// internos do WhatsApp. Depende da lib @wppconnect/wa-js (wppconnect-wa.js)
// já ter sido carregada nesse mesmo contexto antes deste script (ver
// loadWaJsBridge em content.js).
//
// Responsabilidade: saber qual chat individual está ativo agora e disparar
// um CustomEvent('VOE_WHATSAPP_EVENT') com { phone, name } (ou null, quando
// nenhum chat individual está ativo) — o content.js escuta esse evento e
// repassa pra sidebar via postMessage.

function waitForWppReady() {
  if (typeof WPP === 'undefined' || !WPP.isFullReady) {
    setTimeout(waitForWppReady, 200)
    return
  }
  onWppReady()
}

function onWppReady() {
  console.log('[VOE Extension] wa-js pronto (WPP.isFullReady) — escutando chat.active_chat')

  WPP.on('chat.active_chat', async chat => {
    dispatchChatEvent(await resolveActiveChat(chat))
  })
}

async function resolveActiveChat(chat) {
  if (!chat || chat.isGroup) {
    // Sem chat ativo, ou é um grupo — grupos não têm um único telefone
    // associado, então por enquanto não tratamos esse caso.
    return null
  }

  const phone = chat.id?.user ?? null
  if (!phone) return null

  let name = chat.formattedTitle || chat.name || null

  try {
    const contact = await WPP.contact.get(chat.id)
    name = contact?.name || contact?.formattedName || contact?.pushname || name
  } catch (err) {
    console.warn('[VOE Extension] Não foi possível buscar detalhes do contato:', err)
  }

  return { phone, name }
}

function dispatchChatEvent(detail) {
  document.dispatchEvent(new CustomEvent('VOE_WHATSAPP_EVENT', { detail }))
}

waitForWppReady()
