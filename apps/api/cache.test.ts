import { jest } from '@jest/globals';
import {
  queryCache,
  getOrSetCache,
  clearQueryCache,
  createQueryCache,
  resetQueryCache,
} from './cache';

describe('apps/api cache', () => {
  beforeEach(() => {
    clearQueryCache();
  });

  it('caches results and avoids calling fetcher multiple times', async () => {
    const fetcher = jest.fn().mockResolvedValue({ id: 'cluster-123' });

    const first = await getOrSetCache('test:1', fetcher);
    const second = await getOrSetCache('test:1', fetcher);

    expect(first).toEqual({ id: 'cluster-123' });
    expect(second).toEqual({ id: 'cluster-123' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fetches fresh data after cache is cleared', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });

    const first = await getOrSetCache('test:count', fetcher);
    expect(first).toEqual({ count: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    clearQueryCache();

    const second = await getOrSetCache('test:count', fetcher);
    expect(second).toEqual({ count: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('reads CACHE_MAX_ENTRIES and CACHE_TTL_MS from process.env', () => {
    const originalMax = process.env.CACHE_MAX_ENTRIES;
    const originalTtl = process.env.CACHE_TTL_MS;

    try {
      process.env.CACHE_MAX_ENTRIES = '250';
      process.env.CACHE_TTL_MS = '30000';

      const cache = createQueryCache();
      expect(cache.max).toBe(250);
      expect(cache.ttl).toBe(30000);
    } finally {
      process.env.CACHE_MAX_ENTRIES = originalMax;
      process.env.CACHE_TTL_MS = originalTtl;
      resetQueryCache();
    }
  });

  it('falls back to default 500 max and 60000 TTL when env vars are missing or invalid', () => {
    const originalMax = process.env.CACHE_MAX_ENTRIES;
    const originalTtl = process.env.CACHE_TTL_MS;

    try {
      delete process.env.CACHE_MAX_ENTRIES;
      delete process.env.CACHE_TTL_MS;

      const cache = createQueryCache();
      expect(cache.max).toBe(500);
      expect(cache.ttl).toBe(60000);

      process.env.CACHE_MAX_ENTRIES = 'invalid';
      process.env.CACHE_TTL_MS = '-100';

      const fallbackCache = createQueryCache();
      expect(fallbackCache.max).toBe(500);
      expect(fallbackCache.ttl).toBe(60000);
    } finally {
      process.env.CACHE_MAX_ENTRIES = originalMax;
      process.env.CACHE_TTL_MS = originalTtl;
      resetQueryCache();
    }
  });
});
