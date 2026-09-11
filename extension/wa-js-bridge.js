// wa-js-bridge.js
// Roda no CONTEXTO REAL da página do WhatsApp Web.
// Detecta o chat ativo e dispara VOE_WHATSAPP_EVENT.

let chatSeq = 0

function decodeMediaFile(payload) {
  // O leitor de data URLs do WA-JS rejeita MIME com espaços nos parâmetros
  // (ex.: audio/ogg; codecs=opus). File é aceito diretamente pela biblioteca.
  try {
    const binary = atob(payload.base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new File([bytes], payload.fileName || 'arquivo', { type: payload.mimeType || 'application/octet-stream' })
  } catch {
    throw new Error('Arquivo de mídia inválido. Nenhuma mensagem foi enviada.')
  }
}

function waitForWppReady() {
  if (typeof WPP === 'undefined' || !WPP.isFullReady) {
    setTimeout(waitForWppReady, 200)
    return
  }
  onWppReady()
}

function onWppReady() {
  console.log('[VOE Extension] wa-js pronto (WPP.isFullReady) — escutando chat.active_chat')

  // Consulta fresca, correlacionada e sem fallback para um destinatário antigo.
  document.addEventListener('VOE_VERIFY_ACTIVE_CHAT', async event => {
    const seq = chatSeq
    let phone = null
    try {
      const chat = WPP.chat.getActiveChat()
      const id = chat?.id?.toString()
      const resolved = await resolveActiveChat(chat)
      if (seq === chatSeq && id === WPP.chat.getActiveChat()?.id?.toString()) phone = resolved?.phone ?? null
    } catch (_) { /* Falha fechada: nenhuma inserção sem identidade confirmada. */ }
    document.dispatchEvent(new CustomEvent('VOE_VERIFIED_CHAT', { detail: { id: event.detail?.id, phone } }))
  })

  // Mantém o bloqueio até a operação real terminar, inclusive se a UI expirar.
  let sendingMedia = false
  let mediaScopeSeq = 0
  document.addEventListener('VOE_CANCEL_MEDIA_PREPARATION', () => { mediaScopeSeq++ })
  document.addEventListener('VOE_SEND_MEDIA', async event => {
    const payload = event.detail
    const reply = (ok, error) => document.dispatchEvent(new CustomEvent('VOE_MEDIA_SENT', { detail: { id: payload?.id, ok, error } }))
    if (sendingMedia) { reply(false, 'Existe um envio em andamento. Confira a conversa e aguarde.'); return }
    sendingMedia = true
    let started = false
    try {
      if (!['audio', 'image', 'video', 'document'].includes(payload?.mediaType) || !payload.base64) throw new Error('Arquivo inválido para envio.')
      const seq = chatSeq
      const scopeSeq = mediaScopeSeq
      const chat = WPP.chat.getActiveChat()
      const chatId = chat?.id?.toString()
      const resolved = await resolveActiveChat(chat)
      if (!chatId || !payload.expectedPhone || resolved?.phone !== payload.expectedPhone || seq !== chatSeq || scopeSeq !== mediaScopeSeq || chatId !== WPP.chat.getActiveChat()?.id?.toString()) {
        throw new Error('A conversa mudou. Volte ao contato correto antes de enviar.')
      }
      const options = { type: payload.mediaType, filename: payload.fileName, mimetype: payload.mimeType, waitForAck: true }
      if (payload.mediaType === 'audio') {
        // Mensagem de voz com ondas, como o áudio gravado no WhatsApp.
        options.isPtt = true
        options.waveform = true
      } else options.caption = payload.caption || ''
      if (typeof WPP.chat.sendFileMessage !== 'function') throw new Error('O envio de mídia ainda não está disponível. Recarregue o WhatsApp Web.')
      const file = decodeMediaFile(payload)
      started = true
      const result = await WPP.chat.sendFileMessage(chatId, file, options)
      if (!result?.id || !(result.ack >= 1)) throw new Error('Envio sem confirmação do WhatsApp.')
      reply(true)
    } catch (error) {
      reply(false, started ? 'Não foi possível confirmar o envio. Confira a conversa antes de tentar novamente.' : (error instanceof Error ? error.message : 'Não foi possível preparar o envio.'))
    } finally { sendingMedia = false }
  })

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
    const seq = chatSeq
    try {
      const activeChat = WPP.chat.getActiveChat()
      if (activeChat) {
        const result = await resolveActiveChat(activeChat)
        if (seq === chatSeq) dispatchChatEvent(result)
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
