# voe-whatsapp-extension

Extensão Chrome que injeta um painel de atendimento da VOE dentro do
WhatsApp Web — canal de fallback para quando a conexão principal do
módulo Conversas (Evolution API) estiver indisponível.

Ver documento de planejamento completo para contexto de produto,
arquitetura e roadmap.

## ⚠️ Ambiente de desenvolvimento — leia antes de testar

**Existe uma única pasta de trabalho válida para essa extensão:**

```
C:\Users\bruno\voe-whatsapp-extension-run
```

É o clone Git de verdade — a fonte de verdade do projeto. **Nunca copie
esta pasta para outro lugar (Downloads, Área de Trabalho, um zip, etc.)
para testar.** Sempre selecione esse caminho diretamente em
`chrome://extensions` → "Carregar sem compactação".

Isso já causou confusão real uma vez: o Chrome ficou carregando a
extensão a partir de `~\Downloads\voe-whatsapp-extension-skeleton\voe-ext`
— uma cópia solta e desatualizada do zip inicial do projeto, sem
nenhuma relação com o Git. Ícones novos e correções que já estavam
commitadas pareciam "não funcionar", quando na verdade estavam sendo
testadas no lugar errado. Se em algum momento existir dúvida sobre qual
pasta usar, rode `git status` e `git log -1` nela — se não for um
repositório Git com o remote certo (`voe-whatsapp-extension`), não é a
pasta certa.

Dois lembretes operacionais que custaram tempo de debug pra aprender:

- **Depois de recarregar a extensão em `chrome://extensions`, dê F5 na
  aba do WhatsApp Web também** — não basta recarregar só a extensão. O
  content script antigo injetado na aba fica com o contexto invalidado
  (`Extension context invalidated`) e não se reconecta sozinho; sem o
  F5, a sidebar parece travada/quebrada mesmo com a extensão atualizada.
- **`sidebar/` é gerada, nunca editada manualmente.** Qualquer alteração
  dentro de `sidebar-src/` só aparece na extensão depois de rodar
  `npm run build` (dentro de `sidebar-src/`) — ver checklist abaixo.

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
icons/                   Ícones da extensão (símbolo oficial da VOE, extraído de app.voeops.com)
```

## Como testar localmente (checklist completo, do zero)

1. Clone (ou use o clone já existente — ver aviso acima):
   `C:\Users\bruno\voe-whatsapp-extension-run`
2. Instale as dependências da sidebar (só na primeira vez, ou depois de
   mudanças em `package.json`):
   ```
   cd sidebar-src
   npm install
   ```
3. Rode o build da sidebar — **sempre**, mesmo que você ache que não
   mexeu em nada dela; é rápido e evita testar código desatualizado:
   ```
   npm run build     # dentro de sidebar-src/ — sobrescreve ../sidebar
   ```
4. Abra `chrome://extensions`
5. Ative o "Modo do desenvolvedor"
6. Clique em "Carregar sem compactação" e selecione
   `C:\Users\bruno\voe-whatsapp-extension-run` (a pasta raiz do repo —
   **nunca** uma cópia dela)
7. Abra `https://web.whatsapp.com/` — a sidebar deve aparecer encostada
   à direita
8. Depois de qualquer atualização futura (recarregar a extensão pelo
   botão ↻), **dê F5 na aba do WhatsApp Web** — sem isso o content
   script fica com o contexto invalidado e a sidebar não volta sozinha

## Como editar a sidebar (React)

A sidebar é uma SPA React buildada com Vite. **Nunca edite `sidebar/index.html`
ou `sidebar/assets/*` diretamente** — são gerados pelo build e serão
sobrescritos.

```
cd sidebar-src
npm run build     # sobrescreve ../sidebar com o build novo
```

Depois de buildar, recarregue a extensão em `chrome://extensions` (botão ↻)
e dê F5 na aba do WhatsApp Web (ver aviso no topo do README).

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
- [x] Integração com `@wppconnect/wa-js` (captura nome/telefone do chat ativo, incluindo
      resolução de telefone real para contatos com ID `@lid` via `contact.pnForLid` —
      pendente de confirmação em teste ao vivo contra um chat `@lid` de verdade)
- [x] Sidebar migrada pra React (Vite + TypeScript)
- [x] Tela de login (Supabase Auth) + ponte pra token de workspace via `/api/tokens`
- [x] Modo Lead — buscar lead por telefone, avançar etapa do funil, criar anotação
- [x] Modo Lead — criar lead do zero a partir do WhatsApp (contato + oportunidade + vínculo
      via `POST /api/v1/opportunities/[id]/contacts`, endpoint dedicado em `app.voeops.com`)
- [x] Modo Lead — agendar visita (log de atividade em `activities`/`tasks`)
- [x] Modo Lead — marcar vendido/perdido/pausar
- [x] Modo Lead (fase 1) completo, testado de ponta a ponta em ambiente real
- [ ] Modo Locatário ativo — fora do MVP, fase futura
- [x] Ícones finais (símbolo oficial da VOE em 16/48/128px)
- [ ] Publicação na Chrome Web Store

**Modo Lead — fase 2 (expansão inspirada na extensão do RD Station, campos/nomenclatura 100% VOE):**
em teste contra sessão real do WhatsApp Web. Itens marcados `[~]` ainda não tiveram uma rodada de
validação ao vivo depois de escritos.

- [x] **"Salvar contato" separado de "Criar oportunidade"** — o formulário original sempre criava
      contato + oportunidade juntos por trás de um botão só ("Criar lead"), e ficava visualmente
      idêntico a um formulário de contato em workspaces sem Origem/campos personalizados
      configurados (só o campo Nome aparecia). Achado testando ao vivo: nem todo contato que fala
      com a VOE deve virar uma oportunidade de venda. Agora são ações explícitas e distintas:
      "Nova oportunidade" (sempre a ação principal, em cima) e "Novo contato" (só pede Nome) quando
      nada foi encontrado; "Nova oportunidade" e "Vincular oportunidade" (select com as
      oportunidades ativas em ordem alfabética, `LinkExistingOpportunityForm.tsx`) quando o contato
      já existe mas ainda não tem oportunidade.
- [x] **Formulário de Nova Oportunidade completo** — replica campo a campo o formulário real do
      dashboard (`NewOpportunityModal.tsx`): Funil/Etapa, Responsável, Unidade, campos nativos do
      segmento do workspace (dinâmico — não hardcoded, funciona pra qualquer segmento), campos
      personalizados, Qualificação (estrelas com labels do workspace), Orçamento, Origem, Campanha,
      Empresa (vincular/criar). Decisão consciente: a seção "Contato" do formulário real (Sem/
      Vincular/Criar) não foi replicada — na extensão o contato é sempre o do WhatsApp ativo.
- [~] **Sidebar reconstruída pra espelhar exatamente o painel real de Contexto/Atividades do Inbox**
      (`inbox/page.tsx` linhas ~3637-3782 + `ContextPanel.tsx`, 2193 linhas — fonte de verdade
      confirmada campo a campo, mais autoritativa que qualquer lista de campos usada em rodadas
      anteriores). Duas abas fixas no topo, "Contexto" e "Atividades" (`LeadPanel.tsx`), substituindo
      o antigo menu de ações único (`ActionMenu.tsx`, removido).
  - **Aba Contexto**: header do contato (Nome, Cargo, Telefone, E-mail — `role_title`/`email` já
        vinham do `select("*")` de `/api/v1/contacts`, só faltava exibir) + tipo/tags
        (`ContactTagsEditor.tsx`, já existia). Seção "OPORTUNIDADE" com header fixo e ações
        "⇄ Vincular"/"+ Nova"; estado vazio com a caixa de alerta amarela exata ("Lead sem
        oportunidade. Crie ou vincule uma oportunidade.") quando o contato é um Lead, mais o estado
        "Nenhuma oportunidade vinculada". Com oportunidade vinculada (`OpportunityDetail.tsx`, novo,
        substitui `OpportunityCard.tsx`): nome + link "Abrir na VOE", empresa, dropdowns de
        Status/Etapa lado a lado (`StatusStagePicker.tsx`, novo, substitui `StageSelector.tsx` +
        `StatusActions.tsx`), depois os campos na mesma ordem do painel real — Lead Score,
        Qualificação (estrelas), Orçamento estimado, Valor total (somente leitura), Origem, Campanha,
        campos personalizados (`custom_fields`, por oportunidade — antes só apareciam no formulário
        de criação, agora também editáveis aqui), campos nativos do segmento do workspace (dinâmico),
        "Criado em"/"Ganho em"/"Perdido em", e Anotações (`NotesForm.tsx`, já existia). Endpoint
        `GET /api/v1/opportunities` (lista e detalhe) **editado nesta rodada** em `app.voeops.com`
        pra devolver `segment_data` e `unit_id`, que faltavam — sem isso não dava pra ler os valores
        de campo de segmento (Tipo de evento etc.) de uma oportunidade já existente. Escrita usa o
        `PUT` genérico que já existia (aceita qualquer coluna do modelo).
  - **Aba Atividades**: estado vazio idêntico (ícone + "Nenhuma atividade ainda" + "+ Nova
        atividade"). Lista real via `GET /api/v1/tasks?opportunity_id=` (já existia). Decisão de
        escopo: "+ Nova atividade" abre `ScheduleVisitForm.tsx` (já existia, `POST /api/v1/tasks`
        tipo `visit`) em vez do modal genérico do dashboard real (que cobre task/call/email/meeting/
        visit) — cobre o caso de uso principal do segmento, não qualquer tipo de atividade.
  - **"Modelos de mensagens"** (`MessageLibraryPanel.tsx`, já existia) não tem equivalente nas duas
        abas reais — não virou uma terceira aba falsa; movido pra um link discreto no cabeçalho do
        painel, fora da estrutura Contexto/Atividades.
  - **Removido por não ter equivalente no painel real** (nenhum campo desses chegou a ir pra
        produção — eram só do formulário de criação/campo antigo, nunca do painel de contexto):
        nada precisou ser removido nesta rodada além do próprio `ActionMenu.tsx`/`OpportunityCard.tsx`
        /`StageSelector.tsx`/`StatusActions.tsx`, todos substituídos pelos componentes acima.
  - **"Unidade" não é um campo do painel de Contexto real** — aparece só dentro do `WonLostModal`
        (ao marcar Vendido) e no formulário de Nova Oportunidade, nunca como linha exibida/editável
        no Contexto ou na página de detalhe da oportunidade (`deals/[id]/page.tsx`, sem nenhuma
        ocorrência de "Unidade"). Não foi adicionado como campo aqui — ver resumo enviado ao Bruno.
- [ ] Catálogo de Produtos (fotos/vídeos/mensagens) — **fora desta rodada por decisão consciente**:
      maior item novo do pedido, exige migration + UI de gestão nova no dashboard + endpoint v1,
      sem nenhuma especificação de upload/envio ainda. Fica pra uma rodada própria de planejamento.

## Ícones

Os ícones em `icons/` usam o símbolo oficial da VOE (mesmo mark já usado na
sidebar, em `sidebar-src/public/voe-icon.png`), extraído de
`app.voeops.com/public/VOE - Icone-Fundo transparente.png`. Fundo
transparente, sem o nome por extenso — só o símbolo, pra manter legibilidade
no ícone de 16px.
