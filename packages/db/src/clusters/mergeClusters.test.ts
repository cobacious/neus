import { jest } from '@jest/globals';

const mockPrisma = {
  articleClusterAssignment: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  cluster: {
    deleteMany: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let mergeClusters: typeof import('./mergeClusters').mergeClusters;

beforeAll(async () => {
  ({ mergeClusters } = await import('./mergeClusters'));
});

describe('mergeClusters', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 0 if sourceClusterIds only contains target or is empty', async () => {
    const res = await mergeClusters('c1', ['c1']);
    expect(res).toBe(0);
    expect(mockPrisma.articleClusterAssignment.findMany).not.toHaveBeenCalled();
  });

  it('reassigns non-duplicate articles, deletes duplicates, and deletes source clusters', async () => {
    (mockPrisma.articleClusterAssignment.findMany as jest.Mock).mockResolvedValue([
      { articleId: 'a1' },
      { articleId: 'a2' },
    ] as any);

    (mockPrisma.articleClusterAssignment.updateMany as jest.Mock).mockResolvedValue({
      count: 2,
    } as any);

    (mockPrisma.articleClusterAssignment.deleteMany as jest.Mock).mockResolvedValue({
      count: 1,
    } as any);

    (mockPrisma.cluster.deleteMany as jest.Mock).mockResolvedValue({
      count: 1,
    } as any);

    const movedCount = await mergeClusters('target-1', ['source-1']);

    expect(movedCount).toBe(2);

    expect(mockPrisma.articleClusterAssignment.findMany).toHaveBeenCalledWith({
      where: { clusterId: 'target-1' },
      select: { articleId: true },
    });

    expect(mockPrisma.articleClusterAssignment.updateMany).toHaveBeenCalledWith({
      where: {
        clusterId: { in: ['source-1'] },
        articleId: { notIn: ['a1', 'a2'] },
      },
      data: {
        clusterId: 'target-1',
      },
    });

    expect(mockPrisma.articleClusterAssignment.deleteMany).toHaveBeenCalledWith({
      where: {
        clusterId: { in: ['source-1'] },
      },
    });

    expect(mockPrisma.cluster.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['source-1'] },
      },
    });
  });
});
