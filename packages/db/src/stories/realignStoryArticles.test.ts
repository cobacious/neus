import { jest } from '@jest/globals';

const mockPrisma = {
  articleClusterAssignment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockUpdateClusterEmbedding = jest.fn();

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule('../clusters/updateClusterEmbedding', () => ({
  updateClusterEmbedding: mockUpdateClusterEmbedding,
}));

let getStoryArticlesForRealignment: typeof import('./realignStoryArticles').getStoryArticlesForRealignment;
let realignStoryArticles: typeof import('./realignStoryArticles').realignStoryArticles;

beforeAll(async () => {
  ({ getStoryArticlesForRealignment, realignStoryArticles } = await import(
    './realignStoryArticles'
  ));
});

describe('realignStoryArticles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches story articles across cluster ids', async () => {
    (mockPrisma.articleClusterAssignment.findMany as jest.Mock).mockResolvedValue([
      {
        articleId: 'a1',
        clusterId: 'c1',
        article: { id: 'a1', title: 'Hospital Recovery', embedding: [0.1, 0.2] },
      },
    ] as any);

    const res = await getStoryArticlesForRealignment(['c1', 'c2']);
    expect(res).toHaveLength(1);
    expect(res[0].articleId).toBe('a1');
    expect(res[0].currentClusterId).toBe('c1');
  });

  it('reassigns articles when target cluster differs and updates centroid', async () => {
    (mockPrisma.articleClusterAssignment.findUnique as jest.Mock).mockResolvedValue({
      clusterId: 'c1',
    } as any);

    (mockPrisma.articleClusterAssignment.update as jest.Mock).mockResolvedValue({} as any);

    (mockPrisma.articleClusterAssignment.findMany as jest.Mock).mockResolvedValue([
      { article: { embedding: [0.2, 0.4] } },
    ] as any);

    const res = await realignStoryArticles([
      { articleId: 'a1', targetClusterId: 'c2' },
    ]);

    expect(res.updatedCount).toBe(1);
    expect(mockPrisma.articleClusterAssignment.update).toHaveBeenCalledWith({
      where: { articleId: 'a1' },
      data: { clusterId: 'c2' },
    });
    expect(mockUpdateClusterEmbedding).toHaveBeenCalled();
  });

  it('skips update when article is already in target cluster', async () => {
    (mockPrisma.articleClusterAssignment.findUnique as jest.Mock).mockResolvedValue({
      clusterId: 'c1',
    } as any);

    const res = await realignStoryArticles([
      { articleId: 'a1', targetClusterId: 'c1' },
    ]);

    expect(res.updatedCount).toBe(0);
    expect(mockPrisma.articleClusterAssignment.update).not.toHaveBeenCalled();
  });
});
