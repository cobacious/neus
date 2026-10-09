import { jest } from '@jest/globals';

const findMany = jest.fn();
const $queryRaw = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    cluster: { findMany },
    $queryRaw,
  },
}));

let getRankedClusters: typeof import('./getRankedClusters').getRankedClusters;

beforeAll(async () => {
  ({ getRankedClusters } = await import('./getRankedClusters'));
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getRankedClusters', () => {
  it('requests ranked cluster IDs and fetches clusters preserving order', async () => {
    ($queryRaw as any).mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    (findMany as any).mockResolvedValue([
      { id: 'c2', score: 10, storyId: 's2' },
      { id: 'c1', score: 20, storyId: 's1' },
    ]);

    const result = await getRankedClusters(15, 0);

    expect($queryRaw).toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['c1', 'c2'] },
        },
      })
    );
    // Order from ranked query should be preserved (c1 first, then c2)
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('returns empty array when no clusters found', async () => {
    ($queryRaw as any).mockResolvedValue([]);

    const result = await getRankedClusters();

    expect($queryRaw).toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
