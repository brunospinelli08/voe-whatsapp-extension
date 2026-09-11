# Plano: Desempenho de Busca e Edição da Extensão WhatsApp Voe

> Data: 2026-09-10
> Responsável: Michel + agente executor
> Contexto: localizar o contato rapidamente ao abrir uma conversa e editar os dados sem travamentos, recarregamentos desnecessários ou perda de alterações.
> Status: proposta documentada; implementação e decisões técnicas aguardam aprovação.
> Acompanhamento: [Documento de status](<extensao-desempenho-busca-edicao (status).md>).

---

## Escopo

Otimizar o percurso WhatsApp → identificação do contato → carregamento do painel → edição → confirmação no servidor. Priorizar precisão e isolamento por usuário/workspace em todas as otimizações.

Este plano complementa [Melhorias Gerais](extensao-melhorias-gerais.md), em execução por outro agente. Antes de implementar, revisar os commits e o resultado dessa frente. Os achados iniciais não devem ser tratados como retrato garantido do código após as correções.

Não estão autorizados por este documento: implementação, instalação de dependências, alteração de contrato de API, schema, migração de dados, push ou deploy. A solicitação atual autoriza a criação destes documentos.

## Dependências da revisão geral

- Reaproveitar a proteção contra respostas antigas na troca de conversa e nas consultas.
- Coordenar busca exata/desambiguação e filtro de oportunidades por contato com os itens 2.1 e 2.2 do plano geral; não criar duas implementações concorrentes.
- Reaproveitar isolamento de workspace, sincronização entre abas e proteção das retentativas.
- Preservar handshake de inicialização, cancelamento do transporte e idempotência já implementados ou planejados.
- Cache e atualização otimista só podem operar sobre uma identidade de contato e workspace confirmada.

---

## Etapa 1 — Medição e ambiente compatível

### 1.1 Preparar a base local
**Arquivos:** configuração da extensão, cliente de API e configuração local do app.
**Proposta:** conferir branches e contratos após a revisão geral; configurar serviços locais ou mocks explícitos. Um iframe servido pelo Vite local não torna locais a API e o Supabase configurados nele.
**Aceite:** testes não consultam nem modificam produção; alterações existentes do outro agente são preservadas.

### 1.2 Medir o percurso completo
**Proposta:** registrar tempos de mudança de conversa, resolução do telefone pelo WPP, início da busca, resposta da API e painel utilizável. Nas edições, medir interação, envio, confirmação no banco e indicação de sucesso.
**Métricas:** p50/p95, quantidade de chamadas, bytes transferidos, acertos de cache e erros. Usar identificadores de correlação sem registrar tokens, telefones ou conteúdo dos contatos.
**Aceite:** baseline reproduzível para primeiro acesso, retorno ao contato, troca rápida de chat e edição; medir também o tempo total incluindo WPP.

---

## Etapa 2 — Busca direta e resposta compacta

### 2.1 Telefone canônico e consulta exata
**Arquivos:** `hooks/useLeadLookup.ts`, `lib/phoneUtils.ts` e API de contatos no app.
**Proposta:** localizar por workspace e telefone normalizado; usar busca alternativa apenas quando necessário. Resultado ambíguo exige seleção explícita. Não presumir que todo telefone internacional é brasileiro.
**Aceite:** testar telefone brasileiro com/sem nono dígito, legado formatado, telefone internacional, duplicatas e mesmo sufixo com DDD diferente. Nenhum candidato aproximado vence um match exato.
**Dependência:** conciliar com o item 2.1 da revisão geral.

### 2.2 Verificar índices e plano de execução
**Proposta:** inspecionar índices existentes e executar `EXPLAIN (ANALYZE, BUFFERS)` em consultas de leitura sobre uma base local representativa.
**Candidatos a avaliar:** contatos `(workspace_id, phone_e164)`; vínculo `(contact_id, opportunity_id)`; atividades conforme filtros e ordenação usados. Ajustar ao schema real e ao plano de execução, sem criar índices redundantes.
**Aceite:** evidência antes/depois em volume representativo; avaliar custo adicional de escrita. Não criar constraint única sem analisar duplicatas e regra de negócio.
**Aprovação:** qualquer índice/migration ou normalização em massa exige aprovação específica. A limpeza de dados deve ter análise de colisões e estratégia de reversão.

### 2.3 Buscar oportunidades pelo contato
**Proposta:** utilizar filtro no servidor por `contact_id`, com paginação e seleção explícita quando houver várias oportunidades. Definir quais status aparecem, sem ocultar registros silenciosamente.
**Aceite:** encontrar oportunidade vinculada mesmo quando há mais de 500 oportunidades no workspace, sem baixar toda a lista.
**Dependência:** reaproveitar o item 2.2 da revisão geral, que pode ser uma extensão da rota existente, não necessariamente uma nova rota.

### 2.4 Resolver o painel em uma chamada compacta
**Proposta:** avaliar operação que receba o telefone e o contexto autenticado de workspace e retorne contato, empresa resumida e oportunidades vinculadas com os campos essenciais. Validar a autorização no servidor.
**Estratégia:** evitar chamadas sequenciais desnecessárias tanto na extensão quanto dentro da API; carregar histórico, biblioteca e dados secundários sob demanda. Paginar coleções e selecionar somente campos necessários.
**Aceite:** caminho inicial sem download das 500 oportunidades; painel utilizável sem aguardar dados de abas fechadas.
**Decisão pendente:** comparar composição em uma rota com reaproveitamento das rotas existentes após otimização. Manter infraestrutura atual inicialmente; mudança de hospedagem depende de evidência de gargalo.

---

## Etapa 3 — Cache e carregamento progressivo

### 3.1 Cache dos atendimentos recentes
**Proposta:** cache em memória identificado por usuário, workspace e telefone canônico, com vínculos aos IDs dos registros. Exibir imediatamente o contato correto já conhecido e revalidar quando necessário.
**Parâmetros iniciais para medir:** frescor de 30–60 segundos; retenção limitada por quantidade de atendimentos e memória. Não persistir indefinidamente dados pessoais no navegador.
**Aceite:** voltar de B para A apresenta A sem spinner de tela inteira; dados de A nunca aparecem identificados como B; limpeza no logout e invalidação após alteração de acesso.

### 3.2 Cache de configurações e deduplicação
**Proposta:** compartilhar funis, etapas, usuários e opções de campos por contexto de autorização/workspace, com validade maior que os dados do atendimento. Requisições simultâneas da mesma chave compartilham o resultado.
**Aceite:** trocar de contato não busca novamente todas as configurações; troca de workspace não reutiliza opções da conta anterior.
**Decisão pendente:** adotar TanStack Query ou uma camada própria pequena. Comparar dependência/tamanho do bundle com o custo de manter deduplicação, invalidação e concorrência manualmente.

### 3.3 Invalidação direcionada
**Proposta:** gravações atualizam detalhe e resumos afetados. Criação de contato invalida imediatamente resultado negativo da busca; mudança de telefone invalida chaves antiga e nova; vínculo ou desvínculo atualiza oportunidades do contato.
**Aceite:** criar um contato e voltar à conversa não mostra “não encontrado”; editar um orçamento não recarrega configurações ou biblioteca.

### 3.4 Dados secundários sob demanda
**Proposta:** atividades ao abrir a aba, biblioteca ao abrir a central e mídia quando solicitada. Paginar e preservar dados já carregados durante revalidação.
**Aceite:** carregamento inicial leve e sem downloads de mídia não solicitada; seções têm estados locais de carregamento e erro.

---

## Etapa 4 — Edição rápida e confirmação confiável

### 4.1 Atualização otimista por campo
**Arquivos:** `hooks/useOpportunityDetail.ts` e componentes de edição.
**Proposta:** refletir a edição imediatamente, mostrar “Salvando…”, confirmar “Salvo” somente após resposta válida e oferecer recuperação localizada em caso de erro. Usar a resposta canônica da gravação para atualizar o cache sem refazer a busca completa.
**Aceite:** painel e foco permanecem estáveis; validação rejeitada pelo servidor é visível; rollback antigo nunca desfaz uma edição mais recente.

### 4.2 Momento de salvamento por tipo
**Proposta:** seleções salvam após escolher; textos curtos ao sair do campo ou Enter; valores/datas após validação; formulários completos em uma operação ao confirmar. Anotações longas podem usar botão ou autosave aprovado.
**Se houver autosave:** experimentar 400–700 ms sem digitação, agrupando edições ainda não enviadas. Manter a operação vinculada ao registro original quando o usuário trocar de conversa.
**Aceite:** não enviar por tecla; navegar não perde rascunho silenciosamente; falhas e mudanças pendentes permanecem recuperáveis no atendimento correto.

### 4.3 Ordem de gravação e conflitos
**Proposta:** serializar gravações por registro no cliente e agrupar alterações pendentes do mesmo campo. Adotar controle de concorrência no servidor para outras abas/atendentes, com comparação atômica de versão e resposta de conflito.
**Aceite:** ao alterar 5.000 → 6.000, resposta atrasada não restaura 5.000; duas abas não sobrescrevem silenciosamente o mesmo campo. Conflito deve permitir recarregar e reaplicar a intenção do usuário.
**Aprovação:** mecanismo de versão e contrato de conflito precisam de decisão explícita; fila no cliente sozinha não resolve concorrência entre dispositivos.

### 4.4 Patch parcial dos campos de segmento
**Proposta:** enviar apenas o campo alterado e realizar merge atômico no servidor, preservando as demais chaves. Validar tipos, campos permitidos e workspace.
**Aceite:** dois atendentes editando campos diferentes preservam ambas as alterações; edições do mesmo campo seguem a política de conflito aprovada.
**Aprovação:** mudança de contrato e eventual função SQL exigem aprovação.

---

## Etapa 5 — Atualização e validação final

### 5.1 Revalidar ao recuperar foco
**Proposta:** revalidar o atendimento ativo quando os dados estiverem vencidos ao retornar à aba ou recuperar conexão. Consolidar eventos para evitar rajadas de consultas. Atualizações remotas não sobrescrevem rascunhos em edição.
**Evolução opcional:** Realtime direcionado ao registro aberto, caso o requisito de colaboração justifique conexões e complexidade adicionais.

### 5.2 Testes de aceitação e orçamento de desempenho

| Experiência | Meta inicial proposta |
|---|---|
| Reabrir atendimento em cache | p95 ≤ 100 ms para exibir o painel |
| Primeira busca após resolver o telefone | p95 ≤ 500 ms para painel utilizável |
| Feedback visual de edição | p95 ≤ 100 ms |
| Confirmação de gravação | p95 ≤ 800 ms, medida a partir do envio |

Metas não são garantias. Documentar dispositivo, volume de dados, rede simulada, quantidade de amostras e condições de cache. Medir separadamente atraso de debounce e resolução do WPP. Resultados locais não comprovam latência de produção.

**Cenários obrigatórios:** cache frio/quente; workspace com mais de 500 oportunidades; A → B → A; duas abas/workspaces; edição durante refetch; respostas fora de ordem; falha de rede; sessão expirada; contato criado após busca negativa; mudança de telefone; conflito entre atendentes; troca de conversa com salvamento pendente.

**Aceite:** apresentar métricas antes/depois e evidência de correção, não apenas build passando. Executar verificação de tipos, testes das operações críticas e fluxo integrado local compatível com as APIs aprovadas.

---

## Fora de escopo

- Migração automática para VPS, Redis ou motor externo de busca.
- Cache de todo o CRM no navegador e prefetch indiscriminado de contatos.
- Gravações offline com sincronização posterior sem política própria de conflitos.
- Novos recursos comerciais, redesign completo ou alterações no fluxo de envio de mensagens.
- Reimplementar correções já entregues pelo agente da revisão geral.

## Decisões de Michel antes da execução dependente

1. Aprovar escopo e sequência após consolidar a revisão geral.
2. Escolher composição da API e contrato de busca/retorno.
3. Aprovar biblioteca de cache ou implementação própria.
4. Aprovar índices, migrations e eventual tratamento de dados legados após diagnóstico.
5. Aprovar comportamento de autosave e controle de conflitos/patch parcial.

## Impacto de publicação previsto

- **Extensão Chrome:** novo build e distribuição da extensão quando houver alterações nela.
- **Vercel:** alterações nas API routes do app, se aprovadas e implementadas.
- **Supabase:** apenas índices, migrations ou funções SQL efetivamente aprovados.
- **VPS:** não prevista inicialmente; reavaliar somente se o escopo atingir o backend.

Estes documentos não exigem deploy. Implementação e publicação são aprovações distintas.

## Referências

- [PostgreSQL — índices](https://www.postgresql.org/docs/current/indexes.html).
- [TanStack Query — atualizações otimistas](https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates).

