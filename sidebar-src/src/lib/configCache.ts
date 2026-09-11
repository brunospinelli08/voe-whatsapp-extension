// configCache.ts
// Cache em memória para dados de configuração do workspace (pipelines,
// origins, campaigns, custom fields, etc.). Estes dados mudam raramente
// e são requisitados por múltiplos componentes — sem cache, cada mount
// dispara uma nova requisição.
//
// Características:
// - TTL configurável (default 5 min)
// - Deduplicação: requests simultâneos para a mesma chave compartilham
//   a mesma promise (evita N requests paralelos no mount inicial)
// - Invalidação por chave ou total (ex: troca de workspace)

interface CacheEntry<T> {
  data: T
  fetchedAt: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutos

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

/**
 * Busca dados do cache ou executa o fetcher. Requests simultaneos para
 * a mesma chave compartilham a mesma promise.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  // Cache hit
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (entry && Date.now() - entry.fetchedAt < ttlMs) {
    return entry.data
  }

  // Deduplicação: se já tem um fetch em andamento para esta chave, espera
  const existing = inflight.get(key) as Promise<T> | undefined
  if (existing) return existing

  // Fetch novo
  const promise = fetcher().then(data => {
    cache.set(key, { data, fetchedAt: Date.now() })
    inflight.delete(key)
    return data
  }).catch(err => {
    inflight.delete(key)
    throw err
  })

  inflight.set(key, promise)
  return promise
}

/** Invalida uma chave específica. */
export function invalidateCache(key: string): void {
  cache.delete(key)
  inflight.delete(key)
}

/** Invalida todas as chaves que começam com o prefixo. */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
      inflight.delete(key)
    }
  }
}

/** Limpa todo o cache (ex: logout ou troca de workspace). */
export function clearAllCache(): void {
  cache.clear()
  inflight.clear()
}
