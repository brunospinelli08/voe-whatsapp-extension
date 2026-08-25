// config.ts
// Valores públicos (protegidos por RLS no lado do servidor / anon key do
// Supabase) — seguros pra embutir num client como este, do mesmo jeito que
// o app.voeops.com os expõe no bundle do browser (mesmos valores usados lá,
// em NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).

export const SUPABASE_URL = 'https://yjlogamiqdksvceiyfte.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqbG9nYW1pcWRrc3ZjZWl5ZnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NzQzMDgsImV4cCI6MjA4ODI1MDMwOH0.QdleT7CnJvr5obvwG-h-kna-bSxSiHcUrksqcZTWC3o'

// Base da API do app.voeops.com (rotas /api/tokens e /api/v1/*).
export const VOE_API_BASE = 'https://app.voeops.com'
