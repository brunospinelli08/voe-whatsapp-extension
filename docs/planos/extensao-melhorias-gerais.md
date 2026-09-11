# Plano: Melhorias Gerais da Extensao WhatsApp VOE

> Data: 2026-09-10
> Responsavel: Michel + Claude
> Contexto: Extensao Chrome que conecta conversas do WhatsApp Web ao CRM Voe (contatos, oportunidades, atividades). Objetivo: confiabilidade e UX antes de ampliar recursos.

---

## Escopo

A extensao ja tem base funcional. Esta revisao prioriza **confiabilidade e isolamento de dados** — garantir que o painel nunca mostre o contato errado, nunca perca edicoes e nunca duplique acoes.

---

## Etapa 1 — Confiabilidade (bugs criticos)

### 1.1 Race condition na troca de chat
**Arquivo:** `extension/wa-js-bridge.js`
**Problema:** Cada troca de conversa resolve o contato de forma assincrona. Se o usuario trocar rapido (A -> B), a resposta de A pode chegar depois da de B, fazendo o painel mostrar A quando B esta ativo.
**Fix:** Numerar as mudancas de conversa (sequence number), descartar respostas de sequencias antigas.

### 1.2 Race condition em edicoes rapidas (patch/refetch)
**Arquivo:** `sidebar-src/src/hooks/useOpportunityDetail.ts`
**Problema:** `patch()` faz update otimista. Se falhar, chama `fetchDetail()` para reverter. Duas edicoes rapidas podem causar um fetch antigo sobrescrevendo dados novos.
**Fix:** AbortController para cancelar fetch anterior antes de iniciar novo.

### 1.3 Mounted guards nos hooks
**Arquivos:** `useActivities.ts`, `StatusStagePicker.tsx`, `SearchSelect.tsx`, `useOpportunitiesList.ts`
**Problema:** setState apos componente desmontar (warnings React, dados inconsistentes).
**Fix:** Flag `mounted` com cleanup no useEffect; AbortController em debounce do SearchSelect.

### 1.4 Refetch sem piscar (stale-while-revalidate)
**Arquivo:** `sidebar-src/src/hooks/useLeadLookup.ts`
**Problema:** Refetch mostrava spinner e escondia dados existentes.
**Fix:** CONCLUIDO — Separado `loading` (primeira busca) de `revalidating` (refetch em background).

---

## Etapa 2 — Precisao de busca e protecao de acoes

### 2.1 Busca de contato mais precisa
**Arquivo:** `hooks/useLeadLookup.ts` + API route `/api/v1/contacts`
**Problema:** Fallback por ultimos 8 digitos pode casar pessoa diferente. Sem desambiguacao.
**Fix:** Priorizar match exato por phone_e164. Se houver multiplos resultados no fallback, apresentar selecao ao usuario em vez de escolher silenciosamente.
**Nota:** Normalizacao E.164 ja implementada (extensao + API route).

### 2.2 Filtro server-side de oportunidades por contact_id
**Arquivo:** API route `/api/v1/opportunities` + `useLeadLookup.ts`
**Problema:** Extensao baixa ate 500 oportunidades ativas e filtra no cliente. Nao escala e ignora oportunidades fora dessa janela.
**Fix:** Novo parametro `contact_id` na API route. Extensao usa filtro direto em vez de download massivo.

### 2.3 Timeout nao cancela operacao no servidor
**Arquivo:** `sidebar-src/src/lib/backgroundFetch.ts`
**Problema:** Timeout de 25s abandona a espera, mas o fetch continua no background.js. Retry pode duplicar acoes.
**Fix:** Cancelar fetch real via AbortController. Adicionar idempotencia nas mutacoes criticas.

### 2.4 Paste into chat sem verificar conversa ativa
**Arquivo:** `sidebar-src/src/lib/pasteIntoChat.ts` + `extension/content.js`
**Problema:** Midia e baixada e colada no compositor aberto naquele instante. Se o usuario trocar de conversa durante o download, arquivo vai pro chat errado.
**Fix:** Transportar identidade da conversa no pedido, conferir antes de colar.

---

## Etapa 3 — Hardening (para distribuicao)

### 3.1 Validacao de postMessage origin
**Arquivos:** `useActiveChat.ts`, `content.js`
**Problema:** postMessage com destino '*', sem validar event.origin.
**Fix:** Validar origin nas duas pontas.

### 3.2 Workspace divergencia entre abas
**Arquivo:** `lib/apiClient.ts`, `lib/workspaceStorage.ts`
**Problema:** Duas abas podem operar em workspaces diferentes sem saber.
**Fix:** Listener em chrome.storage.onChanged para sincronizar.

### 3.3 Token sem revogacao no logout
**Arquivo:** `lib/voeToken.ts`
**Problema:** Logout apaga tokens locais mas nao revoga no servidor.
**Fix:** Chamar endpoint de revogacao antes de limpar local.

### 3.4 Inicializacao com handshake
**Arquivo:** `extension/wa-js-bridge.js`, `content.js`
**Problema:** Bridge so escuta mudancas futuras. Evento antes do carregamento da sidebar e perdido.
**Fix:** Handshake de inicializacao + reenvio do estado atual.

### 3.5 Audio handoff sem request ID
**Arquivo:** `ScheduleMessagePanel.tsx`, `StandaloneRecorderPage.tsx`
**Problema:** Gravacao de audio nao vincula a uma solicitacao especifica.
**Fix:** Vincular a um ID unico por solicitacao.

---

## Fora de escopo (decisoes de arquitetura)

- Criacao atomica de oportunidade (exigiria nova API route transacional)
- Cache compartilhado entre hooks (ex: origins, campaigns, custom fields)
- Sidebar responsiva (340px fixos)
- Separacao de ambiente dev/prod para APIs

Estes itens ficam para discussao futura se/quando necessario.
