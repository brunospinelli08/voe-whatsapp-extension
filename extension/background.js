// background.js — service worker (Manifest V3)
//
// 1. Abre o WhatsApp Web quando o usuário clica no ícone.
// 2. Faz o proxy das chamadas HTTP da sidebar pro app.voeops.com.
//
// Por quê: host_permissions no manifest.json só dá bypass de CORS pro
// service worker e pra abas em primeiro plano da extensão — NÃO pra um
// iframe (a sidebar) embutido dentro de uma página de terceiro
// (web.whatsapp.com), mesmo esse iframe apontando pra um recurso da própria
// extensão (chrome-extension://). O app.voeops.com não manda header
// Access-Control-Allow-Origin nas rotas /api/tokens e /api/v1/*, então um
// fetch() direto da sidebar é bloqueado por CORS ("Failed to fetch"). O
// service worker, sim, tem o bypass — então a sidebar manda a request pra
// cá via chrome.runtime.sendMessage, e quem executa o fetch de verdade é
// este arquivo.

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://web.whatsapp.com/' })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'VOE_API_FETCH') {
    fetch(message.url, message.init)
      .then(async res => {
        const body = await res.text()
        sendResponse({ ok: true, status: res.status, body })
      })
      .catch(err => {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) })
      })
    return true // mantém o canal aberto — sendResponse é assíncrono
  }

  // Upload de arquivo: a sidebar não consegue mandar um File/Blob de verdade
  // pela ponte de mensagens (chrome.runtime.sendMessage só carrega string
  // de forma confiável) — então ela manda o arquivo em base64, e é aqui,
  // no contexto de service worker (com FormData/Blob completos), que a
  // gente reconstrói o Blob de verdade e monta a request multipart.
  if (message?.type === 'VOE_API_UPLOAD') {
    try {
      const byteChars = atob(message.fileBase64)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], { type: message.fileType })

      const formData = new FormData()
      formData.append('file', blob, message.fileName)
      for (const [key, value] of Object.entries(message.fields || {})) {
        formData.append(key, value)
      }

      fetch(message.url, { method: 'POST', headers: message.headers, body: formData })
        .then(async res => {
          const body = await res.text()
          sendResponse({ ok: true, status: res.status, body })
        })
        .catch(err => {
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) })
        })
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) })
    }
    return true
  }

  return false // não é pra gente, deixa outro listener tratar
})
