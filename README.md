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
  content.js             Injeta a sidebar no WhatsApp Web, redimensiona o layout
                          e carrega wppconnect-wa.js + wa-js-bridge.js no contexto real da página
  background.js          Service worker (abre o WhatsApp Web ao clicar no ícone)
  wppconnect-wa.js        Bundle de @wppconnect/wa-js v4.6.0 (Apache-2.0, via npm)
  wa-js-bridge.js         Escuta chat.active_chat da wa-js e dispara VOE_WHATSAPP_EVENT
                          com { phone, name } do contato ativo
  wa-overrides.css        Ajustes visuais mínimos no layout do WhatsApp Web
sidebar-src/             Código-fonte React da sidebar (Vite + TypeScript)
  src/
    App.tsx, main.tsx
    hooks/                useAuth, useActiveChat, useLeadLookup
    lib/                  supabaseClient, apiClient (v1), voeToken, chromeStorageAdapter
    components/           LoginScreen, LeadPanel, StageSelector, NotesForm
sidebar/                 Build final da sidebar (gerado por `npm run build` em sidebar-src/)
                          — é isso que o content.js carrega no iframe. COMMITADO no repo:
                          a extensão não roda nenhum build no carregamento, só lê os arquivos.
icons/                   Ícones da extensão (placeholder — trocar pelo logo da VOE)
```

## Como testar localmente

1. Abra `chrome://extensions`
2. Ative o "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação" e selecione esta pasta
4. Abra `https://web.whatsapp.com/` — a sidebar deve aparecer encostada à direita

## Como editar a sidebar (React)

A sidebar é uma SPA React buildada com Vite. **Nunca edite `sidebar/index.html`
ou `sidebar/assets/*` diretamente** — são gerados pelo build e serão
sobrescritos.

```
cd sidebar-src
npm install       # só na primeira vez
npm run build     # sobrescreve ../sidebar com o build novo
```

Depois de buildar, recarregue a extensão em `chrome://extensions` (botão ↻)
pra ver as mudanças.

## Autenticação

Login é feito direto contra o **Supabase Auth** do `app.voeops.com` (mesmo
sistema usado pelo dashboard principal — não é um endpoint de login
separado). A sessão dá acesso a um token de workspace (`voe_xxxx`), obtido
automaticamente via `POST /api/tokens` (endpoint já existente no
`app.voeops.com`, usado hoje pela tela de configurações do dashboard) — é
esse token que autentica as chamadas a `/api/v1/opportunities`,
`/api/v1/contacts` etc. Sessão e token ficam salvos em
`chrome.storage.local` (nunca `localStorage`).

## Status atual

- [x] Estrutura base da extensão (manifest, content script, background)
- [x] Injeção da sidebar (iframe) e redimensionamento do layout
- [x] Integração com `@wppconnect/wa-js` (captura nome/telefone do chat ativo)
- [x] Sidebar migrada pra React (Vite + TypeScript)
- [x] Tela de login (Supabase Auth) + ponte pra token de workspace via `/api/tokens`
- [x] Modo Lead — buscar lead por telefone, avançar etapa do funil, criar anotação
- [ ] Modo Lead — criar lead do zero a partir do WhatsApp: **bloqueado**, depende de endpoint
      novo em `/api/v1/*` pra vincular contato à oportunidade (`opportunity_contacts`) — decisão
      pendente com o Bruno antes de mexer numa rota compartilhada com o resto do produto
- [ ] Modo Lead — criar reserva / agendar visita
- [ ] Modo Locatário ativo — fora do MVP, fase futura
- [ ] Ícones finais (trocar placeholder pelo logo da VOE)
- [ ] Publicação na Chrome Web Store

## Ícones

Os ícones em `icons/` são placeholders gerados automaticamente. Substituir
pelo logo oficial da VOE antes de qualquer publicação.
