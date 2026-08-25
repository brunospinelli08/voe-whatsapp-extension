// wa-js-bridge.js
// Este arquivo roda no CONTEXTO REAL da página do WhatsApp Web (não no
// mundo isolado da extensão) — é o único jeito de acessar os módulos
// internos do WhatsApp.
//
// PRÓXIMO PASSO (Passo 4 do guia): instalar a lib @wppconnect-team/wa-js
// e usá-la aqui pra:
//   1. Saber qual chat está ativo agora (WPP.on('chat.active_chat', ...))
//   2. Pegar o telefone do contato ativo
//   3. Disparar um CustomEvent('VOE_WHATSAPP_EVENT') com esses dados,
//      que o content.js escuta e repassa pra sidebar.
//
// Por enquanto, este arquivo é só um placeholder pra validar que a
// injeção no contexto da página está funcionando.

console.log('[VOE Extension] wa-js-bridge.js carregado no contexto da página do WhatsApp Web.')
