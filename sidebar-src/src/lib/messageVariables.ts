// messageVariables.ts
// Variáveis {{...}} das mensagens agendadas — mesmas categorias/chaves do
// VariablePickerButton do dashboard (components/automations/builder/
// VariablePicker.tsx, STATIC_CATEGORIES) com `shortSyntax`: onde existe
// equivalente curto em português (contact.first_name → primeiro_nome) é ele
// que entra no texto, igual ao ActivityModal. O backend aceita as duas formas
// (VARIABLE_ALIASES em voe-backend/src/automation/variable-resolver.ts).
//
// Ficaram de fora só as categorias que dependem de um fluxo de automação
// rodando (Resposta, Evento aguardado, Campanha, Variáveis salvas, Mensagem)
// — numa atividade avulsa elas sempre sairiam vazias.

export interface VariableItem { key: string; label: string; example?: string }
export interface VariableCategory { id: string; label: string; color: string; items: VariableItem[] }

export const VARIABLE_CATEGORIES: VariableCategory[] = [
  {
    id: 'contact', label: 'Contato', color: '#3b82f6', items: [
      { key: 'contact.name', label: 'Nome completo', example: 'João Silva' },
      { key: 'contact.first_name', label: 'Primeiro nome', example: 'João' },
      { key: 'contact.phone', label: 'Telefone', example: '+5511999999999' },
      { key: 'contact.email', label: 'E-mail', example: 'joao@email.com' },
      { key: 'contact.tags', label: 'Tags', example: 'lead-quente, VIP' },
      { key: 'contact.type', label: 'Tipo', example: 'lead' },
      { key: 'contact.source', label: 'Origem', example: 'site' },
      { key: 'contact.role_title', label: 'Cargo', example: 'Diretor' },
    ],
  },
  {
    id: 'company', label: 'Empresa', color: '#8b5cf6', items: [
      { key: 'company.name', label: 'Nome da empresa', example: 'Acme Corp' },
      { key: 'company.cnpj', label: 'CNPJ', example: '12.345.678/0001-90' },
      { key: 'company.phone', label: 'Telefone', example: '+5511988887777' },
      { key: 'company.email', label: 'E-mail', example: 'contato@acme.com' },
      { key: 'company.website', label: 'Site', example: 'acme.com' },
      { key: 'company.city', label: 'Cidade', example: 'Santo André' },
      { key: 'company.state', label: 'Estado (UF)', example: 'SP' },
    ],
  },
  {
    id: 'opportunity', label: 'Oportunidade', color: '#a855f7', items: [
      { key: 'opportunity.name', label: 'Nome', example: 'Projeto X' },
      { key: 'opportunity.value', label: 'Valor', example: 'R$ 5.000,00' },
      { key: 'opportunity.budget', label: 'Orçamento', example: 'R$ 10.000,00' },
      { key: 'opportunity.stage', label: 'Etapa', example: 'Proposta' },
      { key: 'opportunity.source', label: 'Origem', example: 'Instagram' },
      { key: 'opportunity.products', label: 'Produtos (nomes)', example: 'Buffet, Decoração' },
      { key: 'opportunity.products_total', label: 'Total dos produtos', example: 'R$ 12.500,00' },
    ],
  },
  {
    id: 'assigned_user', label: 'Responsável', color: '#f59e0b', items: [
      { key: 'assigned_user.name', label: 'Nome', example: 'Maria Santos' },
      { key: 'assigned_user.email', label: 'E-mail', example: 'maria@voe.com' },
      { key: 'assigned_user.phone', label: 'Telefone', example: '+5511988887777' },
      { key: 'assigned_user.whatsapp', label: 'WhatsApp (canal principal)', example: '+5511988887777' },
    ],
  },
  {
    id: 'activity', label: 'Atividade', color: '#f97316', items: [
      { key: 'activity.title', label: 'Título', example: 'Follow-up João' },
      { key: 'activity.due_date', label: 'Data', example: '04/05/2026' },
      { key: 'activity.due_time', label: 'Horário', example: '14:30' },
      { key: 'activity.due_date_formatted', label: 'Data formatada', example: 'seg, 04/05 às 14:30' },
    ],
  },
  {
    id: 'workspace', label: 'Workspace', color: '#06b6d4', items: [
      { key: 'workspace.name', label: 'Nome do workspace', example: 'Minha Empresa' },
    ],
  },
  {
    id: 'date', label: 'Data', color: '#22c55e', items: [
      { key: 'date.today', label: 'Hoje', example: '04/05/2026' },
      { key: 'date.tomorrow', label: 'Amanhã', example: '05/05/2026' },
      { key: 'date.today+7', label: 'Hoje + N dias (edite o N)', example: '11/05/2026' },
      { key: 'date.weekday', label: 'Dia da semana', example: 'segunda-feira' },
    ],
  },
]

/** Canônica → curta (SHORT_VARIABLE_KEYS de lib/resolveVariables.ts do dashboard). */
const SHORT_VARIABLE_KEYS: Record<string, string> = {
  'contact.name': 'nome',
  'contact.first_name': 'primeiro_nome',
  'contact.phone': 'telefone',
  'contact.email': 'email',
  'contact.type': 'tipo_contato',
  'company.name': 'empresa',
}

export function toShortVariableKey(key: string) {
  return SHORT_VARIABLE_KEYS[key.trim().toLowerCase()] ?? key
}

// Mesmo VARIABLE_REGEX do dashboard (aceita forma curta, canônica, filtros e
// valor padrão) — grupo 1 = chave, 2 = filtros, 3 = fallback.
const VARIABLE_REGEX = /\{\{\s*(tabela\.[a-zA-Z0-9_-]+\.data\([a-zA-Z0-9_.-]+\)\.[a-zA-Z0-9_-]+|[a-zA-Z_][a-zA-Z0-9_.+-]*)((?:\s*\|(?!\|)\s*[a-zA-Z_][a-zA-Z0-9_]*(?::"(?:[^"\\]|\\.)*")?)*)\s*(?:\|\|\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g

/** `{{contact.first_name}}` → `{{primeiro_nome}}` (toShortVariableSyntax do dashboard). */
export function toShortVariableSyntax(text: string) {
  if (!text) return text
  return text.replace(new RegExp(VARIABLE_REGEX.source, 'g'), (match, key: string) => {
    const short = SHORT_VARIABLE_KEYS[key.toLowerCase()]
    return short ? match.replace(key, short) : match
  })
}

export interface VariableContext {
  contactName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  contactType?: string | null
  companyName?: string | null
}

function buildVariableMap(ctx: VariableContext): Record<string, string> {
  const name = ctx.contactName ?? ''
  const firstName = name.split(' ')[0] || ''
  const phone = ctx.contactPhone ?? ''
  const email = ctx.contactEmail ?? ''
  const company = ctx.companyName ?? ''
  const type = ctx.contactType ?? ''
  return {
    nome: name, primeiro_nome: firstName, telefone: phone, email, empresa: company, tipo_contato: type,
    'contact.name': name, 'contact.first_name': firstName, 'contact.phone': phone,
    'contact.email': email, 'contact.type': type, 'company.name': company,
  }
}

function applyTextFilters(value: string, rawFilters: string) {
  let out = value
  for (const f of rawFilters.split(/\|(?!\|)/).map(x => x.trim()).filter(Boolean)) {
    if (f === 'first_name') out = out.split(' ')[0] || ''
    else if (f === 'upper') out = out.toUpperCase()
    else if (f === 'lower') out = out.toLowerCase()
  }
  return out
}

export interface VariableSegment { text: string; isVariable: boolean; resolvedValue?: string }

/** Quebra o texto em trechos, marcando as variáveis e, com contexto, o valor resolvido. */
export function parseVariableSegments(text: string, ctx: VariableContext | null): VariableSegment[] {
  const map = ctx ? buildVariableMap(ctx) : null
  const out: VariableSegment[] = []
  let last = 0
  for (const m of text.matchAll(new RegExp(VARIABLE_REGEX.source, 'g'))) {
    const start = m.index ?? 0
    if (start > last) out.push({ text: text.slice(last, start), isVariable: false })
    let resolvedValue: string | undefined
    if (map) {
      const raw = map[m[1].toLowerCase()] ?? ''
      const value = raw ? applyTextFilters(raw, m[2] ?? '') : ''
      resolvedValue = value || (m[3] !== undefined ? m[3].replace(/\\(["\\])/g, '$1') : undefined)
    }
    out.push({ text: m[0], isVariable: true, resolvedValue })
    last = start + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), isVariable: false })
  return out
}
