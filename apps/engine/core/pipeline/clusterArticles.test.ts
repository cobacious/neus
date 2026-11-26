import { jest } from '@jest/globals';

const mockDb = {
  getUnclusteredArticles: jest.fn(),
  getRecentClustersWithEmbeddings: jest.fn(),
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
    mockDb.getUnclusteredArticles.mockResolvedValue([
      { id: 'a1', sourceId: 's1', embedding: [1, 0] },
      { id: 'a2', sourceId: 's2', embedding: [1, 0] },
    ]);
    mockDb.getRecentClustersWithEmbeddings.mockResolvedValue([]);
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

  it('clusters all articles returned by the DB helper when sources are distinct', async () => {
    mockDb.getUnclusteredArticles.mockResolvedValue([
      { id: 'a1', sourceId: 's1', embedding: [1, 0], clusterAssignments: [] },
      { id: 'a2', sourceId: 's2', embedding: [1, 0], clusterAssignments: [{ clusterId: 'old' }] },
    ]);
    mockDb.getRecentClustersWithEmbeddings.mockResolvedValue([]);
    mockDb.createCluster.mockResolvedValue({ id: 'c1' });

    await clusterRecentArticles();

    const assignments = mockDb.createArticleAssignments.mock.calls[0][0];
    expect(assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ articleId: 'a1', clusterId: 'c1' }),
        expect.objectContaining({ articleId: 'a2', clusterId: 'c1' }),
      ])
    );
  });

  it('does not create clusters when multiple similar articles come from the same single source', async () => {
    mockDb.getUnclusteredArticles.mockResolvedValue([
      { id: 'a1', sourceId: 's1', embedding: [1, 0] },
      { id: 'a2', sourceId: 's1', embedding: [1, 0] },
    ]);
    mockDb.getRecentClustersWithEmbeddings.mockResolvedValue([]);

    await clusterRecentArticles();

    expect(mockDb.createCluster).not.toHaveBeenCalled();
    expect(mockDb.createArticleAssignments).not.toHaveBeenCalled();
    expect(mockDb.updateClusterEmbedding).not.toHaveBeenCalled();
  });

  it('does not create clusters for isolated single articles when ALLOW_SINGLE_ARTICLE_CLUSTERS is false', async () => {
    // Two articles with orthogonal embeddings (similarity = 0)
    mockDb.getUnclusteredArticles.mockResolvedValue([
      { id: 'a1', sourceId: 's1', embedding: [1, 0, 0] },
      { id: 'a2', sourceId: 's2', embedding: [0, 1, 0] },
    ]);
    mockDb.getRecentClustersWithEmbeddings.mockResolvedValue([]);

    await clusterRecentArticles();

    expect(mockDb.createCluster).not.toHaveBeenCalled();
    expect(mockDb.createArticleAssignments).not.toHaveBeenCalled();
    expect(mockDb.updateClusterEmbedding).not.toHaveBeenCalled();
  });

  it('does not assign articles to existing clusters when the temporal gap exceeds the burst window', async () => {
    const oldDate = new Date('2026-11-10T10:00:00Z');
    const newDate = new Date('2026-11-15T10:00:00Z'); // 5 days later (> 48h)

    mockDb.getUnclusteredArticles.mockResolvedValue([
      { id: 'a_new1', sourceId: 's1', publishedAt: newDate, embedding: [1, 0] },
      { id: 'a_new2', sourceId: 's2', publishedAt: newDate, embedding: [1, 0] },
    ]);
    mockDb.getRecentClustersWithEmbeddings.mockResolvedValue([
      { id: 'c_old', embedding: [1, 0], latestArticleAt: oldDate, createdAt: oldDate },
    ]);
    mockDb.createCluster.mockResolvedValue({ id: 'c_new' });

    await clusterRecentArticles();

    // Must NOT assign to c_old; must form new cluster c_new
    expect(mockDb.createCluster).toHaveBeenCalledWith('embedding', null);
    const assignments = mockDb.createArticleAssignments.mock.calls[0][0];
    expect(assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ articleId: 'a_new1', clusterId: 'c_new' }),
        expect.objectContaining({ articleId: 'a_new2', clusterId: 'c_new' }),
      ])
    );
  });
});
