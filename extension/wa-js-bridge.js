// wa-js-bridge.js
// Este arquivo roda no CONTEXTO REAL da página do WhatsApp Web (não no
// mundo isolado da extensão) — é o único jeito de acessar os módulos
// internos do WhatsApp. Depende da lib @wppconnect/wa-js (wppconnect-wa.js)
// já ter sido carregada nesse mesmo contexto antes deste script (ver
// loadWaJsBridge em content.js).
//
// Responsabilidade: saber qual chat individual está ativo agora e disparar
// um CustomEvent('VOE_WHATSAPP_EVENT') com { phone, name } (ou null, quando
// nenhum chat individual está ativo, é um grupo, ou é um contato @lid sem
// telefone resolvido — ver resolveActiveChat) — o content.js escuta esse
// evento e repassa pra sidebar via postMessage.

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

  // O WhatsApp vem migrando contatos pra IDs do tipo @lid (Linked ID —
  // recurso de privacidade que esconde o telefone real, ex: contas
  // Business, comunidades, novos usuários). Quando isso acontece,
  // chat.id.user NÃO é o telefone — é um número interno enorme e sem
  // relação nenhuma com o telefone de verdade (foi assim que apareceu
  // "207086512263415" em vez do telefone real do cliente). Nesses casos,
  // o wa-js resolve o telefone de verdade via contact.pnForLid (Phone
  // Number for LID) — mas só se o WhatsApp já tiver essa relação em
  // cache localmente (pode não ter, em casos raros).
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
      // Não conseguimos resolver o telefone real — melhor não mandar o
      // LID pra frente disfarçado de telefone (criaria lead com telefone
      // errado). Loga bem visível pra facilitar diagnóstico ao vivo.
      console.warn('[VOE Extension] Chat com ID @lid sem telefone resolvido (contact.pnForLid ausente):', chat.id?.toString?.() ?? chat.id)
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
