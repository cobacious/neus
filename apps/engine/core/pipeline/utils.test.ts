import { cosineSimilarity, mapConcurrent } from './utils';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 when either vector has zero norm', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});

describe('mapConcurrent', () => {
  it('returns empty array when input is empty', async () => {
    const res = await mapConcurrent([], 5, async (x) => x);
    expect(res).toEqual([]);
  });

  it('preserves order of results with async delays', async () => {
    const items = [10, 5, 20, 1];
    const res = await mapConcurrent(items, 2, async (item) => {
      await new Promise((r) => setTimeout(r, item));
      return item * 2;
    });
    expect(res).toEqual([20, 10, 40, 2]);
  });

  it('bounds active concurrent executions', async () => {
    let active = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5, 6, 7, 8];

    await mapConcurrent(items, 3, async (num) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return num;
    });

    expect(peak).toBeLessThanOrEqual(3);
  });
});
