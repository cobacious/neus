import { jest } from '@jest/globals';

const mockDb = {
  getRecentEmbeddedArticles: jest.fn(),
  createCluster: jest.fn(),
  createArticleAssignments: jest.fn(),
  updateClusterEmbedding: jest.fn(),
};

// Use unstable_mockModule for ESM
jest.unstable_mockModule('@neus/db', () => mockDb);

let clusterRecentArticles: typeof import('./clusterArticles').clusterRecentArticles;

beforeAll(async () => {
  ({ clusterRecentArticles } = await import('./clusterArticles'));
});

describe('clusterRecentArticles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates clusters for similar articles', async () => {
    mockDb.getRecentEmbeddedArticles.mockResolvedValue([
      { id: 'a1', embedding: [1, 0] },
      { id: 'a2', embedding: [1, 0] },
    ]);
    mockDb.createCluster.mockResolvedValue({ id: 'c1' });

    await clusterRecentArticles();

    expect(mockDb.createCluster).toHaveBeenCalledTimes(1);
    expect(mockDb.createArticleAssignments).toHaveBeenCalledTimes(1);
    expect(mockDb.updateClusterEmbedding).toHaveBeenCalledTimes(1);
    const assignments = mockDb.createArticleAssignments.mock.calls[0][0];
    expect(assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ articleId: 'a1', clusterId: 'c1' }),
        expect.objectContaining({ articleId: 'a2', clusterId: 'c1' }),
      ])
    );
  });
});
