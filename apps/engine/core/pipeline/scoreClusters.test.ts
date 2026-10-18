import { jest } from '@jest/globals';

const mockDb = {
  getClustersForScoring: jest.fn(),
  updateClusterScoresBatch: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

let scoreClusters: typeof import('./scoreClusters').scoreClusters;

beforeAll(async () => {
  ({ scoreClusters } = await import('./scoreClusters'));
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('scoreClusters', () => {
  it('fetches clusters and updates scores in batch', async () => {
    const now = Date.now();
    const mockClusters = [
      {
        id: 'c1',
        articleAssignments: [
          { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.8 } } },
          { article: { publishedAt: new Date(now), sourceId: 's2', sourceRel: { trustScore: 0.8 } } },
        ],
      },
    ];

    mockDb.getClustersForScoring.mockResolvedValue(mockClusters);
    mockDb.updateClusterScoresBatch.mockResolvedValue(1);

    await scoreClusters();

    expect(mockDb.getClustersForScoring).toHaveBeenCalledTimes(1);
    expect(mockDb.updateClusterScoresBatch).toHaveBeenCalledTimes(1);
    const updates = (mockDb.updateClusterScoresBatch as any).mock.calls[0][0];
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('c1');
    expect(updates[0].score).toBeGreaterThan(0);
  });
});
