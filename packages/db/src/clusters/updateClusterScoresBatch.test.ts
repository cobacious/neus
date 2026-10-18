import { jest } from '@jest/globals';

const $executeRaw = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    $executeRaw,
  },
}));

let updateClusterScoresBatch: typeof import('./updateClusterScoresBatch').updateClusterScoresBatch;

beforeAll(async () => {
  ({ updateClusterScoresBatch } = await import('./updateClusterScoresBatch'));
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateClusterScoresBatch', () => {
  it('returns 0 without executing raw query when updates array is empty', async () => {
    const result = await updateClusterScoresBatch([]);
    expect(result).toBe(0);
    expect($executeRaw).not.toHaveBeenCalled();
  });

  it('executes batch update for provided cluster scores', async () => {
    ($executeRaw as any).mockResolvedValue(2);

    const updates = [
      { id: 'c1', score: 1.45 },
      { id: 'c2', score: 0.89 },
    ];

    const result = await updateClusterScoresBatch(updates);

    expect(result).toBe(2);
    expect($executeRaw).toHaveBeenCalledTimes(1);
  });

  it('chunks updates into batches of 500', async () => {
    ($executeRaw as any).mockResolvedValue(500);

    const updates = Array.from({ length: 1050 }, (_, i) => ({
      id: `cluster-${i}`,
      score: 1.0,
    }));

    await updateClusterScoresBatch(updates);

    expect($executeRaw).toHaveBeenCalledTimes(3);
  });
});
