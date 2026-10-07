import { jest } from '@jest/globals';

const mockPrisma = {
  cluster: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  articleClusterAssignment: {
    deleteMany: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let disbandSingleArticleClusters: typeof import('./disbandSingleArticleClusters').disbandSingleArticleClusters;

beforeAll(async () => {
  ({ disbandSingleArticleClusters } = await import('./disbandSingleArticleClusters'));
});

describe('disbandSingleArticleClusters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes clusters with 0 or 1 article assignment and no headline', async () => {
    (mockPrisma.cluster.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', _count: { articleAssignments: 1 } },
      { id: 'c2', _count: { articleAssignments: 0 } },
      { id: 'c3', _count: { articleAssignments: 3 } }, // Has multiple articles, should not be deleted
    ] as any);

    (mockPrisma.articleClusterAssignment.deleteMany as jest.Mock).mockResolvedValue({ count: 1 } as any);
    (mockPrisma.cluster.deleteMany as jest.Mock).mockResolvedValue({ count: 2 } as any);

    const result = await disbandSingleArticleClusters();

    expect(result).toBe(2);
    expect(mockPrisma.articleClusterAssignment.deleteMany).toHaveBeenCalledWith({
      where: { clusterId: { in: ['c1', 'c2'] } },
    });
    expect(mockPrisma.cluster.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c2'] } },
    });
  });

  it('returns 0 when there are no dummy clusters', async () => {
    (mockPrisma.cluster.findMany as jest.Mock).mockResolvedValue([
      { id: 'c3', _count: { articleAssignments: 2 } },
    ] as any);

    const result = await disbandSingleArticleClusters();

    expect(result).toBe(0);
    expect(mockPrisma.articleClusterAssignment.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.cluster.deleteMany).not.toHaveBeenCalled();
  });
});
