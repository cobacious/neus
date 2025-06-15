export function cosineSimilarity(a: number[], b: number[]): number {
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
