# Status: Melhorias Gerais da Extensao WhatsApp VOE

> Plano de referencia: `extensao-melhorias-gerais.md`
> Ultima atualizacao: 2026-09-10

---

## Etapa 1 — Confiabilidade

| Item | Status | Data | Notas |
|------|--------|------|-------|
| 1.1 Race condition troca de chat | Concluido | 2026-09-10 | Sequence number em wa-js-bridge.js; descarta respostas de chats anteriores |
| 1.2 Race condition patch/refetch | Concluido | 2026-09-10 | AbortController + mountedRef em useOpportunityDetail.ts |
| 1.3 Mounted guards nos hooks | Concluido | 2026-09-10 | useActivities, StatusStagePicker (pipelines), SearchSelect (debounce cancelled flag) |
| 1.4 Refetch stale-while-revalidate | Concluido | 2026-09-10 | useLeadLookup separou loading/revalidating |

## Etapa 2 — Precisao de busca e protecao

| Item | Status | Data | Notas |
|------|--------|------|-------|
| 2.1 Busca de contato mais precisa | Parcial | 2026-09-10 | E.164 normalizado (extensao + API). Falta desambiguacao multi-resultado |
| 2.2 Filtro server-side oportunidades | Concluido | 2026-09-10 | Novo param contact_id na API (commit 2191fd0). useLeadLookup usa filtro direto |
| 2.3 Timeout nao cancela operacao | Pendente | — | Requer mudanca no background.js (AbortController no fetch real) |
| 2.4 Paste verifica conversa ativa | Concluido | 2026-09-10 | pasteMediaIntoChat recebe expectedPhone; content.js responde VOE_GET_CURRENT_CHAT |

## Etapa 3 — Hardening

| Item | Status | Data | Notas |
|------|--------|------|-------|
| 3.1 Validacao postMessage origin | Concluido | 2026-09-10 | useActiveChat valida origin (whatsapp.com, chrome-extension://, localhost dev) |
| 3.2 Workspace sync entre abas | Pendente | — | Baixa prioridade (extensao usada em 1 aba) |
| 3.3 Token revogacao no logout | Pendente | — | Requer endpoint de revogacao no backend |
| 3.4 Inicializacao com handshake | Pendente | — | Melhoria de UX, nao e bug |
| 3.5 Audio handoff com request ID | Concluido | 2026-09-10 | requestId gerado no ScheduleMessagePanel, enviado na URL, verificado no listener |

---

## Outras entregas da sessao (2026-09-10)

| Entrega | Status | Notas |
|---------|--------|-------|
| Normalizacao E.164 na extensao | Concluido | `phoneUtils.ts` criado, lookup usa `phone_search` |
| API route GET phone_search | Concluido | Deployado na Vercel (commit 549680f) |
| API route POST auto phone_e164 | Concluido | Deployado na Vercel (commit 549680f) |
| API route GET contact_id filter | Concluido | Deployado na Vercel (commit 2191fd0) |
| Dev mode (Vite HTTPS + HMR) | Concluido | `VOE_DEV_MODE` flag via chrome.storage.local |
| Release v1.0.0 no GitHub | Concluido | Tag + release criados |

---

## Itens pendentes (proxima sessao)

| Item | Motivo pendente |
|------|-----------------|
| 2.1 Desambiguacao multi-resultado | UX design: como mostrar selecao de contatos na sidebar |
| 2.3 Timeout cancela operacao real | Requer AbortController no background.js (service worker) |
| 3.2 Workspace sync entre abas | Baixa prioridade |
| 3.3 Token revogacao no logout | Requer endpoint backend |
| 3.4 Inicializacao com handshake | Melhoria de UX |

---

## Historico de atualizacoes

- **2026-09-10** — Plano criado. E.164 normalizado e deployado. Refetch stale-while-revalidate concluido. Dev mode configurado. Release v1.0.0.
- **2026-09-10** — Etapa 1 completa: race condition no chat switch (sequence number), race condition no patch (AbortController), mounted guards em useActivities/StatusStagePicker/SearchSelect.
- **2026-09-10** — Etapas 2 e 3 (parciais): filtro contact_id deployado na Vercel, useLeadLookup com filtro direto + mountedRef, paste verifica conversa ativa, validacao de postMessage origin, audio handoff com request ID.
