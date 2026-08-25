// background.js — service worker (Manifest V3)
// Mínimo por enquanto: abre o WhatsApp Web quando o usuário clica no ícone.

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://web.whatsapp.com/' })
})
