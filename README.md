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
        atividade"). Lista real via `GET /api/v1/tasks?opportunity_id=` (já existia). "+ Nova
        atividade" agora abre o modal completo — ver item abaixo (substituiu o `ScheduleVisitForm.tsx`
        inline da rodada anterior, removido).
  - **"Modelos de mensagens"** (`MessageLibraryPanel.tsx`, já existia) não tem equivalente nas duas
        abas reais — não virou uma terceira aba falsa; movido pra um link discreto no cabeçalho do
        painel, fora da estrutura Contexto/Atividades.
  - **"Agendar mensagem"** (`ScheduleMessagePanel.tsx`, novo — segundo link no mesmo cabeçalho,
        ao lado de "Modelos de mensagens") — espelha o agendamento de WhatsApp da aba Conversa real
        (`ScheduleDropdown.tsx` + `handleScheduleTextFromInput` em `inbox/page.tsx`): grava uma
        atividade `type: "whatsapp"` em `activities` via `POST /api/v1/tasks` (endpoint já existente,
        nenhuma mudança pra aceitar o shape). Quem envia de fato é o `scheduler.worker`/
        `wa-send.worker` do `voe-backend` — servidor, funciona com o navegador/extensão fechados.
        Só texto livre nesta rodada (sem mídia, sem template Cloud API — fica pra fase futura).
        Precisou de um endpoint novo em `app.voeops.com`, `GET /api/v1/channels` (lista
        `whatsapp_channels` do workspace — a extensão não tinha nenhuma noção de canal até agora;
        auto-seleciona se só existir 1, mostra seletor se houver mais). Também gated pela mesma
        feature de plano do dashboard (`scheduled_whatsapp_sending`, checada server-side em
        `checkFeatureAccessServer.ts`) — evita que a extensão libere pra um workspace Starter algo
        que o dashboard bloqueia.
  - **Agendar direto de um "Modelo de mensagem"** (fase 2, `MessageLibraryPanel.tsx`) — segundo
        botão "Agendar" ao lado de "Copiar" em cada item de texto (`content_type === 'text'`; itens
        de mídia/carrossel da biblioteca real não têm suporte de agendamento nesta rodada). Abre o
        mesmo `ScheduleMessagePanel` no lugar da lista, com o conteúdo do modelo pré-preenchido e um
        "Voltar" pra retornar. Só aparece com um contato já resolvido (agendar exige `contact_id`).
  - **Agendar mídia da biblioteca** (fase 3 — áudio/imagem/vídeo/documento, `content_type !==
        'text'` com `file_url`). `ScheduleMessagePanel.tsx` agora tem dois modos: texto livre
        (editável) ou mídia (pré-visualização não-editável — badge de tipo + nome do arquivo — com
        legenda opcional). Caminho durável do Storage extraído da URL assinada da biblioteca
        (`extractStoragePathFromUrl`, portado igual ao real de `mediaTypes.ts` em `app.voeops.com`
        — função pura, sem dependência), pra permitir ao `wa-send.worker` gerar uma signed URL fresca
        no momento do envio em vez de reusar a original (que pode ter expirado até lá). Bloqueado em
        canal API Oficial (Cloud API) igual ao real — agendamento de mídia só funciona em canal API
        Voe. Continua sem carrossel interativo e sem template Cloud API.
  - **Gerenciar mensagem já agendada** (fase 4, `ActivitiesPanel.tsx`) — "Enviar agora" e
        "Cancelar" por atividade, só pra `type === 'whatsapp' && status === 'agendada'`. Mesma
        semântica exata de `useNewActivities.ts` no dashboard: cancelar só muda `status` pra
        "cancelada" (não deleta); "enviar agora" adianta `scheduled_at` pra agora mantendo status
        "agendada" — o `scheduler.worker` pega na próxima passada (≤30s) pelo fluxo de envio normal,
        não é um caminho separado. Via `PUT /api/v1/tasks/[id]` (endpoint já existente). Escopo
        deliberadamente restrito a isso — reagendar (mudar data/hora) e reabrir uma cancelada ficam
        de fora; o resto do CRUD de atividades (concluir tarefa etc.) não fazia parte do pedido de
        agendamento de mensagens.
  - **"+ Nova atividade" reposicionado** (`ActivitiesPanel.tsx`) — ficava embaixo da lista de
        atividades; movido pra logo abaixo das abas Contexto/Atividades, acima do histórico
        (pedido explícito do Bruno).
  - **Trocar de funil** (`StatusStagePicker.tsx`, pedido explícito do Bruno) — espelha o chip
        "Funil" que fica ao lado do status em `deals/[id]/page.tsx` no dashboard real, na mesma
        posição relativa aqui (logo acima da dupla Status|Etapa). Em vez do menu popover em 2
        passos do dashboard, reaproveita o mesmo padrão de chips já usado pra escolher funil em
        Nova Oportunidade (`CreateOpportunityForm.tsx`, classes `.pipeline-chips`/`.pipeline-chip`)
        — só aparece com mais de um funil no workspace, funil sem etapas fica desabilitado com
        aviso. Escolher outro funil só troca as opções do `<select>` de Etapa; a mudança só é
        salva de fato ao escolher uma etapa nele — sem endpoint novo, usa o mesmo
        `PUT /api/v1/opportunities/:id/stage` que a troca de etapa já usava (o pipeline é derivado
        do `stage_id` no backend). Ainda sem teste ao vivo.

Com isso, as 4 fases do plano de agendamento de mensagens na extensão (espelhando o agendamento da
aba Conversa real) estão implementadas — texto livre, biblioteca de mensagens (texto e mídia) e
gestão básica do que já foi agendado.

**Correção achada na rodada de testes pré-deploy** (sem UI ao vivo pra validar visualmente, testado
por outras vias — ver abaixo): `ScheduleMessagePanel.tsx` não mandava `opportunity_id` ao criar a
atividade `whatsapp` (só `contact_id`, igual ao real `handleScheduleTextFromInput` do dashboard).
Só que a aba Atividades da extensão (`useActivities.ts`) — diferente do painel do Inbox real, que é
por `contact_id` — lista por `opportunity_id`. Resultado: toda mensagem agendada pelas fases 1/2/3
ficava invisível na aba Atividades, deixando os botões "Cancelar"/"Enviar agora" da fase 4 sem nada
pra agir. Corrigido passando `opportunity_id` (quando o lead já tem oportunidade vinculada) desde
`LeadPanel.tsx` → `MessageLibraryPanel`/`ScheduleMessagePanel` → `POST /api/v1/tasks`. Sem
oportunidade vinculada, a mensagem ainda agenda e envia normalmente (`contact_id` já basta pro
`wa-send.worker`), só não aparece nessa lista — mesma limitação que o real teria se não tivesse o
painel do Inbox separado.

**Testes rodados antes do deploy** (sem WhatsApp Web ao vivo disponível neste ambiente):
`tsc --noEmit` + `vite build` limpos nos 4 rounds; `next build` completo do `app.voeops.com` limpo;
suíte `vitest` completa (72/72, incluindo testes novos escritos pra `/api/v1/channels` e o gate de
`/api/v1/tasks`, seguindo o padrão `route.test.ts` já usado no projeto); `eslint` limpo nos arquivos
tocados; schema real (`whatsapp_channels`, `workspaces`, `workspace_addons`, `activities`,
`message_library` — colunas, CHECK constraints, enum `whatsapp_provider`) conferido direto contra o
Supabase de produção via MCP, incluindo o gate de plano rodado à mão contra 3 workspaces reais
(Starter nega, Scale libera) e a extração de storage path (`extractStoragePathFromUrl`) testada
contra URLs assinadas/públicas reais da `message_library`. Não substitui um teste real no WhatsApp
Web — é o que deu pra verificar sem um.

**Redesign visual (pedido explícito, depois de testar ao vivo)** — a primeira versão do agendamento
e da biblioteca de mensagens estava com poluição visual: ações sempre visíveis, presets sem ícone,
checkbox cru, `<input type=date>` nativo. Refeito espelhando exatamente `ScheduleDropdown.tsx` +
`SmartDatePicker.tsx` + `MessageCenterPanel.tsx` do app.voeops.com:
  - `ScheduleMessagePanel.tsx`: mini-calendário completo de "Personalizar" (navegação de mês, grade
    de dias, coluna de horários — `whatsappDatePresets.ts`, novo, porta o ramo `type === "whatsapp"`
    de `buildPresets`/`buildTimeSlots` do real, diferente do conjunto "base" de Nova Atividade),
    presets com ícone, chip colorido de horário relativo, toggle de verdade (não checkbox) pra
    "pausar se responder", card único pro conteúdo (mensagem/mídia + canal).
  - `MessageLibraryPanel.tsx`: header com contagem, busca (client-side), ícones monocromáticos por
    tipo (áudio/imagem/vídeo/documento — troca dos emojis coloridos anteriores) em vez de badge de
    emoji, ações reveladas só no hover do card (igual ao `group-hover:opacity-100` real) em vez de
    dois botões sempre visíveis, badge de categoria.
  - Escopo consciente: sem os filtros de categoria/tags nem o dropdown de "modelo" (coleção) do real
    — dependem de taxonomia do workspace (`message_library_labels`/`message_collections`) que a
    extensão não busca; ficaria fora de um ajuste puramente visual.

**Anexar arquivo/foto/vídeo/documento novo + gravar áudio** (pedido explícito) — até aqui só dava
pra agendar mídia já salva na biblioteca; agora também dá pra anexar algo novo direto do dispositivo,
igual ao menu "+" do compositor real (`AttachmentMenu.tsx`, só "Fotos e vídeos"/"Documento" — sem
outras opções no real). Só aparece no modo texto livre (sem mídia de biblioteca já fixada).
  - `POST /api/v1/media` (novo, `app.voeops.com`) — gêmeo autenticado por token de
    `/api/whatsapp/upload-media` (cookie-auth, dashboard): sobe pro bucket `media` do Storage,
    devolve `storage_path` (não signed URL — o `wa-send.worker` gera uma fresca na hora do envio,
    mesmo mecanismo já usado pra mídia da biblioteca). Mesmos limites de tamanho por tipo (imagem
    5MB, vídeo/áudio 16MB, documento 100MB), validados com as mesmas funções puras de
    `mediaTypes.ts` portadas pro client (`sidebar-src/src/lib/mediaTypes.ts`, checagem antecipada
    antes de gastar upload com um arquivo que vai ser rejeitado).
  - **Achado técnico importante durante a implementação**: a ponte `chrome.runtime.sendMessage` que
    a sidebar usa pra falar com `background.js` (necessária porque o iframe da sidebar não ganha o
    bypass de CORS do `host_permissions` — só o service worker ganha) só carregava **string** até
    agora — um `FormData`/`File` seria descartado silenciosamente. Resolvido convertendo o arquivo
    pra base64 na sidebar (`backgroundUploadFile` em `backgroundFetch.ts`), reconstruindo um `Blob`
    de verdade no `background.js` (contexto de service worker, com `FormData`/`Blob` completos) antes
    de montar a request multipart de verdade. Limite prático de 15MB pro upload pela extensão (mais
    conservador que os 100MB do servidor pra documento) — base64 infla ~33% o tamanho, e arquivo
    grande demais na mensagem trava a UI durante a codificação; documento grande continua dando pra
    anexar pelo dashboard normal.
  - `AudioRecorderPanel.tsx` (novo) — versão simplificada de `AudioRecorder.tsx` (sem
    pausar/retomar, sem waveform ao vivo — só gravar, ouvir o preview, descartar ou usar), sobe pelo
    mesmo `/api/v1/media`. Precisou de `iframe.allow = 'microphone'` em `content.js` — sem isso
    `getUserMedia` é bloqueado por Permissions Policy antes até de perguntar, mesmo sendo um iframe
    da própria extensão (é cross-origin em relação a `web.whatsapp.com`, que é quem o hospeda).
  - **Confirmado ao vivo: microfone dentro do iframe da sidebar não funciona** — `getUserMedia`
    dava `NotAllowedError` mesmo com `allow="microphone"` no iframe. Permissions Policy só delega o
    "direito de pedir"; o Chrome não concede (nem chega a perguntar) microfone de verdade pra um
    iframe cross-origin sem contexto de navegação de topo próprio. Corrigido com uma solução
    diferente da tentativa original: "Gravar áudio" agora abre uma **aba própria da extensão**
    (`StandaloneRecorderPage.tsx`, roteada por `?mode=recorder` em `main.tsx` — sem login/contexto de
    lead, só a gravação) — lá, sendo um contexto de topo de verdade, o Chrome pede a permissão
    normalmente. O áudio gravado volta pra sidebar por `chrome.runtime.sendMessage` (broadcast —
    `fileBase64/fileName/fileType` em `fileBase64.ts`, mesma técnica do upload). Limitação conhecida:
    com mais de uma aba do WhatsApp Web aberta simultaneamente, o broadcast pode entregar o áudio pro
    painel errado (não tem correlação de qual aba pediu) — baixa probabilidade, não resolvido nesta
    rodada.
  - O relay base64 → Blob de upload de arquivo (`/api/v1/media`) segue sem teste ao vivo — só o
    endpoint em si foi testado (schema real + `vitest`); o caminho completo sidebar → background.js →
    servidor com um arquivo de verdade ainda não foi confirmado na prática.

**Escolher modelo de dentro do agendamento** (pedido explícito) — lacuna real do fluxo: antes só
dava pra chegar no agendamento PARTINDO da biblioteca ("Modelos de mensagens" → item → "Agendar");
não tinha o caminho inverso ("já estou na tela de agendar, quero escolher um modelo agora"). Botão
"Usar um modelo" dentro do `ScheduleMessagePanel.tsx` abre um seletor compacto embutido
(`TemplatePickerInline.tsx`, novo — busca + lista de uma linha por item, um clique já seleciona, sem
duplicar os botões "Copiar"/"Agendar" da lista completa, que não fazem sentido aqui: só existe UMA
ação possível). `libraryItem` deixou de ser só uma prop fixa e virou estado interno
(`selectedLibraryItem`) — os dois caminhos (vindo de fora via prop, ou escolhido de dentro via
picker) convergem pro mesmo estado, reaproveitando 100% da lógica de preview/remover/trocar que já
existia. Modelo de texto pré-preenche e continua editável (like "inserir"); modelo de mídia fixa a
mídia (como já era) mas agora com "Trocar"/remover pra sair sem precisar recomeçar o formulário do
zero. `SCHEDULABLE_TYPES`/`TYPE_ICONS` viraram fonte única em `TemplatePickerInline.tsx`, importados
por `MessageLibraryPanel.tsx` (antes duplicados nos dois arquivos).

**Criar modelo de mensagem novo, de dentro da extensão** (pedido explícito) — até aqui a extensão só
lia a biblioteca (`GET /api/v1/message-library`); criação era só pelo dashboard
(`MessageLibrarySettings.tsx`, insert direto via Supabase client-side). Agora dá pra criar sem sair
da extensão, botão "+ Novo" no cabeçalho de "Modelos de mensagens" → `CreateTemplateScreen.tsx`.
  - Dois endpoints novos no `app.voeops.com`: `POST /api/v1/message-library/media` (upload pro bucket
    **`message-library`** — diferente do bucket `media` usado no anexo de agendamento; devolve
    `file_url` já assinada por 1h, igual ao real — mesma limitação de expiração que o dashboard já
    tem, sem refresh automático) e `POST /api/v1/message-library` (cria a linha, espelha `createItem()`
    de `useMessageLibrary.ts`).
  - Extensão reaproveita 100% da infraestrutura de anexo/gravação já construída pro agendamento —
    `voeApi.upload`, o relay base64 do `backgroundUploadFile`, e a aba avulsa de gravação
    (`StandaloneRecorderPage.tsx` + broadcast `VOE_AUDIO_HANDOFF`) — só troca o endpoint de destino.
    Zero código novo pra upload/gravação em si.
  - Categoria usa as 11 categorias padrão do real (`DEFAULT_CATEGORIES`, portado em
    `messageLibraryCategories.ts`) — `category` é texto livre no banco (sem CHECK constraint), então
    qualquer uma bate certinho com o que o dashboard já entende.
  - **Escopo consciente, pra manter a tela enxuta** (pedido explícito de cuidado com poluição
    visual): sem carrossel, sem tags, sem transcrição automática de áudio (`/api/transcribe` no
    dashboard) — grava/anexa o áudio, mas o campo de legenda fica em branco até o usuário escrever
    algo. Tela é só: seletor de tipo (5 ícones), título, categoria, conteúdo (contextual ao tipo),
    favorito, botão criar — nada além disso.
  - Testado: `tsc --noEmit` + `vite build` limpos na extensão; os dois endpoints novos com
    `next build`/`eslint`/`vitest` limpos no `app.voeops.com` (16 testes novos).
  - **Removido por não ter equivalente no painel real** (nenhum campo desses chegou a ir pra
        produção — eram só do formulário de criação/campo antigo, nunca do painel de contexto):
        nada precisou ser removido nesta rodada além do próprio `ActionMenu.tsx`/`OpportunityCard.tsx`
        /`StageSelector.tsx`/`StatusActions.tsx`, todos substituídos pelos componentes acima.
  - **"Unidade" não é um campo do painel de Contexto real** — aparece só dentro do `WonLostModal`
        (ao marcar Vendido) e no formulário de Nova Oportunidade, nunca como linha exibida/editável
        no Contexto ou na página de detalhe da oportunidade (`deals/[id]/page.tsx`, sem nenhuma
        ocorrência de "Unidade"). Não foi adicionado como campo aqui — ver resumo enviado ao Bruno.
- [~] **Modal "Nova Atividade" (réplica do `ActivityModal.tsx` real, 2239 linhas)** — abre a partir
      do "+ Nova atividade" da aba Atividades. Seletor de tipo com os mesmos 6 blocos (Tarefa,
      WhatsApp, Ligação, E-mail, Reunião, Visita); Título/Descrição; Oportunidade e Contato exibidos
      já preenchidos com o contexto ativo (não pede pra escolher de novo); Responsável (dropdown,
      `useWorkspaceUsers`, pré-preenchido com o usuário logado — igual ao real); atalhos de "Quando"
      (`lib/activityDatePresets.ts`, réplica linha a linha da lógica de `SmartDatePicker.tsx`: Hoje,
      Amanhã 9h, Amanhã 14h, Em 1 hora, Próx. segunda, Próx. semana, + "Ontem" só pra Reunião/Visita,
      igual ao real) com "Personalizar" abrindo `<input type="date">`/`<input type="time">` nativos
      em vez do calendário completo; rodapé "Cancelar"/"Criar atividade". Valores de `type`
      confirmados via schema real do Supabase (constraint `activities_type_check1`): exatamente
      `task | whatsapp | call | email | meeting | visit`. `POST /api/v1/tasks` já existia (genérico,
      sem endpoint novo) — testado ponta a ponta direto no banco de produção (insert simulando o
      payload exato do modal, na oportunidade "Michel Spinelli (WhatsApp)" de teste, depois
      removido).
  - **Ligação/E-mail**: desabilitados com "Em breve", igual ao real (`ACTIVITY_TYPES` já marca os
        dois `disabled: true` — nem a própria VOE os tem disponíveis).
  - **WhatsApp desabilitado AQUI, diferente do real** (decisão consciente, não pedida
        literalmente): no dashboard real, criar uma atividade WhatsApp exige canal + modelo/mensagem
        (Cloud API ou Evolution) — todo o subsistema de agendamento de campanha, fora de escopo.
        Criar sem isso geraria uma atividade "fantasma" que o worker de disparo nunca conseguiria
        processar. Badge mostra "No dashboard" (não "Em breve", que seria impreciso — a VOE tem
        WhatsApp agendado, só não nesta extensão).
  - **Bug real encontrado e corrigido**: a coluna `status` de `activities` tem default `'pending'`
        no banco (legado), mas todo o app real sempre manda `status: "agendada"` explicitamente no
        insert — sem isso, uma atividade nova cai fora do bucket "pendente" que o dashboard usa pra
        listar (`status === "agendada"`). O `ScheduleVisitForm.tsx` antigo (removido nesta rodada)
        nunca mandava `status`, e por isso **5 visitas reais criadas via extensão em 2026-08-25 no
        workspace de teste ficaram com `status: "pending"`**, mal classificadas no dashboard real —
        achado confirmado direto no banco, não corrigido nesses 5 registros sem perguntar ao Bruno
        primeiro. O modal novo sempre manda `status: "agendada"` explicitamente, corrigindo a causa
        pra qualquer atividade criada daqui pra frente.
  - **Bug real encontrado e corrigido: dropdown de Responsável quebrado (vinha vazio)**. A busca da
        sessão (usuário logado, pra pré-preencher) e a de `useWorkspaceUsers` são duas chamadas
        assíncronas sem ordem garantida — o `<select>` renderizava sem nenhuma `<option>` até a lista
        carregar (aparecia em branco/quebrado), e se o usuário logado fosse super admin (filtrado de
        propósito por `/api/v1/workspace-users`, mesmo filtro do formulário real) o problema persistia
        mesmo depois de carregar. `CreateOpportunityForm.tsx` já tinha essa proteção
        (`{users.length > 0 && ...}`) nesse mesmo campo; `NewActivityModal.tsx` não tinha. Corrigido:
        `<select>` desabilitado com opção "Carregando…" enquanto a lista não chega, e o Responsável
        selecionado cai pro primeiro usuário da lista se o ID da sessão não for um usuário de verdade
        do workspace.
  - **Fim do evento / dia inteiro** (reunião/visita, no real) não foi replicado — `due_date` +
        `due_time` já bastam pra criar; ficam `null`.
- [x] **Botão "Voltar" no formulário de Nova/Vincular oportunidade e Novo contato** — clicar em
      "+ Nova"/"⇄ Vincular"/"Novo contato" escondia os botões do cabeçalho da seção "Oportunidade" e
      não colocava nada no lugar; a única saída era rolar até o fim do formulário (longo, no caso de
      "Nova oportunidade") até achar o "Cancelar". Agora um "‹ Voltar" ocupa o lugar do título
      "Oportunidade" enquanto o formulário está aberto — mesmo tratamento visual (versalete, mesmo
      peso/tamanho), sem novo elemento solto na tela.
- [ ] Catálogo de Produtos (fotos/vídeos/mensagens) — **fora desta rodada por decisão consciente**:
      maior item novo do pedido, exige migration + UI de gestão nova no dashboard + endpoint v1,
      sem nenhuma especificação de upload/envio ainda. Fica pra uma rodada própria de planejamento.
- [x] **Passada de design** (só CSS — nenhum componente/hook mudou de lugar ou de comportamento):
      header com gradiente teal da marca (antes branco chapado), abas Contexto/Atividades viraram um
      controle segmentado em pílula, fundo do app com halos de cor bem suaves, tela de login/escolha
      de workspace com hero colorido + logo com glow + card elevado pro formulário, botões com sombra
      e leve elevação no hover (com reset explícito pra chips/links/pílulas, que não devem ter esse
      efeito), acento de cor nos títulos de seção e nos ícones de estado vazio. Validado renderizando
      a tela de login e o topo do painel com Edge headless + amostragem de pixel — o texto pequeno
      saiu com contraste pior no screenshot que no app de verdade (artefato conhecido de
      `--disable-gpu`/fontes web em renderização headless, confirmado comparando com um teste de
      controle), então o título deixou de usar texto com gradiente clipado (mais arriscado) e passou
      pra cor sólida.
- [x] **Correção de bug**: `overflow: hidden` adicionado na passada de design acima (achando que
      precisava conter os halos de cor decorativos, o que nunca foi verdade — `background:` não vaza
      da caixa sozinho) quebrou o scroll da tela de escolha de workspace, deixando workspaces mais
      abaixo na lista inacessíveis. Trocado por `overflow-y: auto` + `justify-content: safe center`
      (nunca `center` puro num flex column que pode ter overflow — deixa o topo do conteúdo
      inacessível mesmo com o scroll funcionando). Testado forçando 21 workspaces numa tela de 700px.
- [x] **Menu "•••" no header (`ContactActionsMenu.tsx`)** — substitui o antigo botão "Sair" isolado.
      Abre um dropdown ancorado (hand-rolled: ref + clique fora + Esc — não existe um componente de
      dropdown genérico no design system do app.voeops.com pra reaproveitar; `ConversationContextMenu.tsx`
      de lá usa exatamente esse mesmo padrão à mão) com, nessa ordem: Editar contato, Desassociar
      empresa, Criar empresa, Associar empresa, separador, **Sair** (vermelho, `--color-accent` — a
      mesma cor que o app já usa pra ações destrutivas/erro, não uma cor nova). Itens do contato ficam
      desabilitados sem um contato ativo; "Sair" sempre disponível. O contato ativo é reportado de
      `LeadPanel.tsx` pro `App.tsx` (`onContactContextChange`), já que o botão mora no header, um
      nível acima de onde o lookup do contato acontece.
  - **Editar contato** (`EditContactModal.tsx`): réplica do `EditContactModal` real — que só existe
        *inline* dentro de `ContextPanel.tsx` (Inbox), nunca foi um componente exportado — Nome*,
        Telefone, E-mail, Cargo, Tipo de contato, Tags. `PUT /api/v1/contacts/:id` (genérico, já
        existia, endpoint zero novo).
  - **Desassociar empresa**: `PUT /api/v1/contacts/:id { company_id: null }` — mesmo endpoint
        genérico. `company_id` é FK simples (um contato pertence no máximo a uma empresa, não é
        relação N:N), então "desassociar" nunca foi mais que isso.
  - **Criar empresa** (`CreateCompanyModal.tsx`): réplica exata do modal real "Nova Empresa"
        (`companies/page.tsx`) — Nome*, Telefone/Email, Site/Instagram, CNPJ/Estado, Cidade, mesmos
        placeholders da captura. `POST /api/v1/companies` (genérico, já existia). **Associação
        automática confirmada no código real** antes de implementar (`contacts/[id]/page.tsx`,
        `handleEditSubmit`): criar uma empresa a partir do contexto de um contato SEMPRE associa no
        mesmo fluxo — primeiro cria a empresa, depois atualiza `contact.company_id` — sem passo manual
        separado. Replicado exatamente assim aqui: `POST /api/v1/companies` seguido de
        `PUT /api/v1/contacts/:id { company_id }`.
  - **Associar empresa** (`AssociateCompanyModal.tsx`): busca empresas existentes via
        `GET /api/v1/companies?search=` (já existia) reaproveitando `SearchSelect.tsx` (mesmo
        componente já usado em `CompanySection.tsx`) + `PUT /api/v1/contacts/:id { company_id }`.
  - **Esforço real: zero endpoints novos.** Só precisou de um join novo (`company:companies(id,name)`)
        em `GET`/`PUT /api/v1/contacts` (app.voeops.com) — mesmo padrão aditivo do `segment_data`/
        `unit_id` de uma rodada anterior — pra extensão saber o nome da empresa vinculada sem uma
        chamada extra. Sem isso, "Desassociar" ainda funcionaria (só precisa saber que `company_id`
        existe), mas o header não mostraria qual empresa é.
  - **Empresa vinculada agora aparece no header do contato** (ícone + nome, mesma posição do
        `ContextPanel.tsx` real) — não existia antes desta rodada.

**Ajustes visuais no cabeçalho do lead** (pedido explícito, com uma correção de rumo logo em
seguida):
  - **"Modelos de mensagens"/"Agendar mensagem" ficam um embaixo do outro, no lado direito da linha
    do nome** — não mais lado a lado (que disputava espaço com o nome na mesma linha) nem numa linha
    própria abaixo (tentativa intermediária, revertida a pedido — o Bruno preferiu manter os botões
    junto do nome, só empilhados). `LeadPanel.tsx` + `.header-actions`/`.active-chat-header-top` em
    `styles.css`: `flex-direction: column` + `align-items: flex-end`, de volta dentro da mesma linha
    do `<strong>` via `justify-content: space-between`.
  - **Hover verde do botão**: cheguei a identificar e corrigir um bug sistêmico de especificidade CSS
    (a regra genérica `button:hover` vazando fundo verde em botões "flat" que não deveriam ter isso —
    afetava uns 10+ componentes, não só os dois do cabeçalho). O Bruno testou e não gostou do
    resultado — pediu explicitamente pra reverter. **Revertido por completo**: o hover voltou a ser o
    de antes (herdando o verde da regra genérica `button:hover:not(:disabled)`) em todos os
    componentes onde a correção tinha sido aplicada. Registrado aqui pra não redescobrir o mesmo
    "bug" numa rodada futura achando que é algo novo — é comportamento atual, mantido de propósito.

**"Personalizar" simplificado + botão "Agendar envio" travando sem erro** (pedido explícito):
  - **Calendário de "Personalizar" reduzido a um só bloco, largura cheia** — layout anterior (mês +
    lista de horários scrollável lado a lado, réplica fiel do `SmartDatePicker.tsx` real) não cabia
    bem nos ~300px úteis da sidebar; ficava apertado e o scroll da lista de horários era ruim. Cortada
    a lista de horários inteira — o `<input type="time">` nativo (já existia como "Hora
    personalizada") virou o único seletor de horário dentro de "Personalizar", e o calendário ganhou
    a largura toda pra si (células maiores, mais legíveis). `buildWhatsAppTimeSlots` removida de
    `whatsappDatePresets.ts` (ficou sem nenhum uso). Os presets com hora fixa da linha de cima (Em 1
    hora, manhã 7h/8h/9h etc.) continuam do jeito que estavam — só "Personalizar" mudou.
  - **Causa real do botão "Agendar envio" travando sem erro nenhum**: `chrome.runtime.sendMessage`
    (a ponte sidebar → background.js, usada em toda chamada de API E no upload de arquivo) não tinha
    timeout — se o service worker travasse ou fosse suspenso no meio de uma request, a promise nunca
    resolvia nem rejeitava, e `saving`/`uploading` em `ScheduleMessagePanel.tsx` ficavam presos em
    `true` pra sempre (o `finally` que os reseta nunca era alcançado), desabilitando o botão
    silenciosamente, sem mensagem de erro nenhuma. Corrigido com um timeout de 25s
    (`sendMessageWithTimeout` em `backgroundFetch.ts`) — pior caso agora vira um erro visível e
    recuperável, não uma trava indefinida. Também soltei o botão "Gravar áudio": antes ficava preso
    em "Aguardando gravação…" pra sempre se a aba de gravação fosse fechada sem terminar; agora
    continua clicável pra tentar de novo.

**Consolidação: agendamento de mensagem virou "Nova Atividade → WhatsApp"** (pedido explícito do
chefe do Bruno, repassado numa reunião) — mudança estrutural, não só visual:
  - **"Modelos de mensagens"/"Agendar mensagem" não existem mais como botões avulsos no cabeçalho
    do lead.** O único caminho agora é Aba Atividades → "+ Nova atividade" → tipo **WhatsApp**
    (antes desabilitado com badge "No dashboard" — igual ao real, exigia canal+modelo, subsistema
    que a extensão não tinha ainda). Decisão consciente: sem manter os dois botões como atalho
    extra — um caminho só, igual a real VOE organiza (Nova Atividade é o ponto de entrada pra
    qualquer tipo de atividade, WhatsApp incluso).
  - `NewActivityModal.tsx`: quando o tipo "WhatsApp" é selecionado, o formulário genérico
    (Título/Descrição/Responsável/Quando) é **trocado inteiro** por `ScheduleMessagePanel.tsx` —
    que já tem seu próprio formulário completo (canal, mensagem/mídia/modelo, calendário,
    pausar-se-responder, submit). Não dá pra aninhar o `<form>` dele dentro do `<form>` genérico
    (inválido em HTML), então o seletor de tipo saiu de dentro do form — fica sempre visível, e
    cada ramo (genérico vs. WhatsApp) tem seu próprio `<form>` abaixo dele.
  - `ScheduleMessagePanel.tsx` ganhou `onScheduled?: () => void` — quando fornecido (uso dentro do
    modal), fecha o modal e recarrega a lista de atividades, igual aos outros tipos. Sem uso
    avulso (aquele fornecido só pelo cabeçalho, que não existe mais), o parâmetro simplesmente
    não é passado.
  - **`MessageLibraryPanel.tsx` removido** — toda a capacidade dele (buscar, listar, criar via "+
    Novo") foi absorvida por `TemplatePickerInline.tsx` ("Usar um modelo", de dentro do
    agendamento). **Perda consciente**: não existe mais um jeito de só "Copiar" um modelo pra
    colar manualmente no WhatsApp Web sem agendar — só resta agendar. Se isso fizer falta, é fácil
    trazer de volta um botão "Copiar" dentro do `TemplatePickerInline`.
  - **Botão de voltar vermelho** (pedido explícito — "algumas páginas ficam sem saída"): achei que
    o `ScheduleMessagePanel`/`MessageLibraryPanel` (removido) realmente não tinham nenhuma saída
    própria — só o botão do cabeçalho, que rolava pra fora de vista com o formulário longo. A
    consolidação acima já resolve isso (agora vivem dentro do modal, que tem cabeçalho fixo/sticky
    com X sempre visível, `position: sticky` já existia). Pra reforçar visualmente, criei
    `.back-button-danger` (mesmo `.back-button` cinza que já existia nos formulários de
    Oportunidade/Contato, só que vermelho) e apliquei em `TemplatePickerInline.tsx`/
    `CreateTemplateScreen.tsx` — as duas telas que trocam a tela inteira de dentro do fluxo de
    agendamento. Não mexi no `.back-button` cinza original (usado em Nova Oportunidade/Vincular/
    Novo contato) — esses já tinham saída, não eram o alvo da reclamação.

## Ícones

Os ícones em `icons/` usam o símbolo oficial da VOE (mesmo mark já usado na
sidebar, em `sidebar-src/public/voe-icon.png`), extraído de
`app.voeops.com/public/VOE - Icone-Fundo transparente.png`. Fundo
transparente, sem o nome por extenso — só o símbolo, pra manter legibilidade
no ícone de 16px.
