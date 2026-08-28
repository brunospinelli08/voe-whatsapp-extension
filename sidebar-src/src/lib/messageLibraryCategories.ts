// messageLibraryCategories.ts
// Réplica de DEFAULT_CATEGORIES (messageLibraryLabels.ts, app.voeops.com) —
// as 11 categorias padrão da Central de Mensagens. `category` na tabela
// message_library é texto livre (sem CHECK constraint), mas essa é a lista
// que semeia workspaces novos e serve de fallback de exibição — usar
// qualquer uma dessas garante que o valor bate com o que o dashboard já
// entende, mesmo sem a extensão buscar a taxonomia customizada do workspace
// (message_library_labels — fora de escopo, mesma decisão já tomada pro
// filtro de categorias em MessageLibraryPanel/TemplatePickerInline).

export const DEFAULT_CATEGORIES: { slug: string; name: string }[] = [
  { slug: 'abertura', name: 'Abertura' },
  { slug: 'qualificacao', name: 'Qualificação' },
  { slug: 'apresentacao', name: 'Apresentação' },
  { slug: 'engajamento', name: 'Engajamento' },
  { slug: 'follow-up', name: 'Follow-up' },
  { slug: 'recuperacao', name: 'Recuperação' },
  { slug: 'visita', name: 'Visita' },
  { slug: 'proposta', name: 'Proposta' },
  { slug: 'fechamento', name: 'Fechamento' },
  { slug: 'pos-venda', name: 'Pós-venda' },
  { slug: 'geral', name: 'Geral' },
]
