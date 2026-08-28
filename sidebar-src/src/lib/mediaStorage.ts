// mediaStorage.ts
// Réplica exata de extractStoragePathFromUrl (app.voeops.com,
// src/lib/whatsapp/mediaTypes.ts) — função pura, sem dependência do
// Supabase, então dá pra portar direto. Usada pra guardar o caminho
// durável do Storage a partir da URL assinada que vem da biblioteca de
// mensagens, permitindo ao wa-send.worker (voe-backend) gerar uma signed
// URL fresca no momento do envio — a URL assinada original pode ter
// expirado até lá, se o agendamento for pra um horário mais distante.

/** Extrai { bucket, path } de uma URL do Supabase Storage (signed ou pública). */
export function extractStoragePathFromUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null
  const m = url.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/(.+?)(?:\?|$)/)
  if (!m) return null
  return { bucket: m[1], path: decodeURIComponent(m[2]) }
}
