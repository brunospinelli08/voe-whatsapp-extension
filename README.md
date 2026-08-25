# voe-whatsapp-extension

Extensão Chrome que injeta um painel de atendimento da VOE dentro do
WhatsApp Web — canal de fallback para quando a conexão principal do
módulo Conversas (Evolution API) estiver indisponível.

Ver documento de planejamento completo para contexto de produto,
arquitetura e roadmap.

## Estrutura

```
manifest.json           Configuração da extensão (Manifest V3)
extension/
  content.js             Injeta a sidebar no WhatsApp Web e redimensiona o layout
  background.js          Service worker (abre o WhatsApp Web ao clicar no ícone)
  wa-js-bridge.js         Roda no contexto real da página — vai integrar com @wppconnect-team/wa-js
  wa-overrides.css        Ajustes visuais mínimos no layout do WhatsApp Web
sidebar/
  index.html              UI da sidebar (placeholder por enquanto)
icons/                   Ícones da extensão (placeholder — trocar pelo logo da VOE)
```

## Como testar localmente

1. Abra `chrome://extensions`
2. Ative o "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação" e selecione esta pasta
4. Abra `https://web.whatsapp.com/` — a sidebar (placeholder) deve aparecer encostada à direita

## Status atual

- [x] Estrutura base da extensão (manifest, content script, background)
- [x] Injeção da sidebar (iframe) e redimensionamento do layout
- [ ] Integração com `@wppconnect-team/wa-js` (ler chat ativo)
- [ ] Tela de login dedicado (autenticação contra a API da VOE)
- [ ] Modo Lead (criar lead, funil, anotações, criar reserva/visita)
- [ ] Modo Locatário ativo (status, pendências, histórico)
- [ ] Endpoints novos no `voebackend`
- [ ] Ícones finais (trocar placeholder pelo logo da VOE)
- [ ] Publicação na Chrome Web Store

## Ícones

Os ícones em `icons/` são placeholders gerados automaticamente. Substituir
pelo logo oficial da VOE antes de qualquer publicação.
