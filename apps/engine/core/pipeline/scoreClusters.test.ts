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

  it('groups clusters by storyId and passes story member clusters for score roll-up', async () => {
    const now = Date.now();
    const mockClusters = [
      {
        id: 'angle-1',
        storyId: 'story-100',
        articleAssignments: [
          { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.8 } } },
          { article: { publishedAt: new Date(now), sourceId: 's2', sourceRel: { trustScore: 0.8 } } },
        ],
      },
      {
        id: 'angle-2',
        storyId: 'story-100',
        articleAssignments: [
          { article: { publishedAt: new Date(now), sourceId: 's3', sourceRel: { trustScore: 0.8 } } },
          { article: { publishedAt: new Date(now), sourceId: 's4', sourceRel: { trustScore: 0.8 } } },
        ],
      },
      {
        id: 'standalone',
        storyId: null,
        articleAssignments: [
          { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.8 } } },
          { article: { publishedAt: new Date(now), sourceId: 's2', sourceRel: { trustScore: 0.8 } } },
        ],
      },
    ];

    mockDb.getClustersForScoring.mockResolvedValue(mockClusters);
    mockDb.updateClusterScoresBatch.mockResolvedValue(3);

    await scoreClusters();

    expect(mockDb.updateClusterScoresBatch).toHaveBeenCalledTimes(1);
    const updates = (mockDb.updateClusterScoresBatch as any).mock.calls[0][0];
    expect(updates).toHaveLength(3);

    const scoreMap = new Map(updates.map((u: any) => [u.id, u.score]));
    // The story angle pools sources from angle-1 and angle-2 (4 unique sources vs 2 for standalone)
    // and receives an umbrella multiplier, outranking the standalone 2-source cluster
    expect((scoreMap.get('angle-1') as number)).toBeGreaterThan(scoreMap.get('standalone') as number);
  });
});
