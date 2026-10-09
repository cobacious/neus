export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (normA * normB);
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const intersection = new Set([...A].filter((x) => B.has(x)));
  const union = new Set([...A, ...B]);
  return intersection.size / union.size;
}

/**
 * Executes an async task over an array of items with bounded concurrency.
 * Preserves the order of results corresponding to the input items.
 *
 * @param items - Array of items to process
 * @param concurrency - Maximum number of simultaneous async tasks
 * @param fn - Worker function returning a Promise for each item
 */
export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
