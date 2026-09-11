# Status: Desempenho de Busca e Edicao da Extensao WhatsApp Voe

> Plano de referencia: [extensao-desempenho-busca-edicao.md](extensao-desempenho-busca-edicao.md)
> Ultima atualizacao: 2026-09-10
> Estado geral: itens 2.1, 2.3, 3.1, 3.2, 3.3, 4.1 e 5.1 implementados; demais pendentes.

---

## Etapa 1 — Medicao e ambiente compativel

| Item | Status | Data | Notas |
|------|--------|------|-------|
| 1.1 Base local compativel | Concluido | 2026-09-10 | Dev mode via Vite HTTPS + VOE_DEV_MODE flag |
| 1.2 Medicao do percurso | Pendente | — | Baseline nao medido formalmente; melhoria perceptivel |

## Etapa 2 — Busca direta e resposta compacta

| Item | Status | Data | Notas |
|------|--------|------|-------|
| 2.1 Telefone canonico e match exato | Concluido | 2026-09-10 | normalizeToE164 + phone_search na API (commit 549680f) |
| 2.2 Indices e plano de execucao | Pendente | — | Diagnostico local antes de propor migration |
| 2.3 Oportunidades por contato | Concluido | 2026-09-10 | Filtro contact_id na API (commit 2191fd0); useLeadLookup usa filtro direto |
| 2.4 Resposta compacta do painel | Pendente | — | Avaliar rota unica vs rotas separadas otimizadas |

## Etapa 3 — Cache e carregamento progressivo

| Item | Status | Data | Notas |
|------|--------|------|-------|
| 3.1 Cache de atendimentos recentes | Concluido | 2026-09-10 | leadCache.ts: cache por telefone, TTL 60s, max 20 entradas, stale-while-revalidate |
| 3.2 Configuracoes e deduplicacao | Concluido | 2026-09-10 | configCache.ts: TTL 5min, dedup de requests simultaneos. 10 hooks migrados |
| 3.3 Invalidacao direcionada | Concluido | 2026-09-10 | invalidateAndRefetch em handleDone (LeadPanel); invalida leadCache + opp-detail ao criar/editar |
| 3.4 Dados secundarios sob demanda | Parcial | 2026-09-10 | Atividades carregam so ao abrir aba. Cache evita refetch redundante |

## Etapa 4 — Edicao rapida e confirmacao confiavel

| Item | Status | Data | Notas |
|------|--------|------|-------|
| 4.1 Atualizacao otimista por campo | Concluido | 2026-09-10 | useOpportunityDetail com patch otimista + AbortController + cache |
| 4.2 Momento de salvamento | Pendente | — | Aprovar comportamento por campo |
| 4.3 Ordem e conflitos | Pendente | — | Fila por registro + controle atomico |
| 4.4 Patch parcial de segmento | Pendente | — | Contrato e eventual funcao SQL |

## Etapa 5 — Atualizacao e validacao final

| Item | Status | Data | Notas |
|------|--------|------|-------|
| 5.1 Revalidar ao recuperar foco | Concluido | 2026-09-10 | visibilitychange listener no useLeadLookup; revalida dados do chat ativo ao voltar pra aba |
| 5.2 Testes e metricas finais | Pendente | — | — |

---

## Registro de decisoes

| Decisao | Estado | Observacao |
|---------|--------|------------|
| Implementar este plano | Aprovado (3.1, 3.2, 3.3, 5.1) | Demais itens aguardam aprovacao individual |
| Biblioteca de cache | Decidido: camada propria | configCache.ts (~70 linhas) em vez de TanStack Query |
| Composicao e contrato de API | Nao decidido | Comparar apos medicao formal |
| Indices e migrations | Nao aprovado | — |
| Autosave e conflitos | Nao decidido | — |

## Status de deploy

- **Extensao:** build pronto; reload no chrome://extensions + F5 no WhatsApp Web.
- **Vercel:** 2 commits deployados (contacts phone_search + opportunities contact_id).
- **Supabase:** nenhuma alteracao.
- **VPS:** nenhuma alteracao.

## Historico de atualizacoes

- **2026-09-10** — Criados plano e acompanhamento. Nenhuma implementacao.
- **2026-09-10** — Implementados: leadCache (3.1), configCache (3.2) com 10 hooks migrados, limpeza de cache no logout/troca de workspace.
- **2026-09-10** — Implementados: invalidacao direcionada (3.3) com invalidateAndRefetch no LeadPanel, cache no useOpportunityDetail. Revalidacao ao recuperar foco (5.1) via visibilitychange.
