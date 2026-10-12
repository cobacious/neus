import { LRUCache } from 'lru-cache';

export function createQueryCache() {
  const maxEntries = parseInt(process.env.CACHE_MAX_ENTRIES || '500', 10);
  const ttlMs = parseInt(process.env.CACHE_TTL_MS || '60000', 10);

  return new LRUCache<string, any>({
    max: isNaN(maxEntries) || maxEntries <= 0 ? 500 : maxEntries,
    ttl: isNaN(ttlMs) || ttlMs <= 0 ? 60000 : ttlMs,
  });
}

export let queryCache = createQueryCache();

/**
 * Resets the active cache instance (used when changing env vars or in tests).
 */
export function resetQueryCache() {
  queryCache = createQueryCache();
  return queryCache;
}

/**
 * Fetch a value from cache, or invoke the fetcher and cache the result.
 */
export async function getOrSetCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = queryCache.get(key);
  if (cached !== undefined) {
    return cached as T;
  }
  const result = await fetcher();
  queryCache.set(key, result);
  return result;
}

/**
 * Clears all entries in the active query cache.
 */
export function clearQueryCache(): void {
  queryCache.clear();
}
