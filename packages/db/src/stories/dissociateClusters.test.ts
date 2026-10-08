import { jest } from '@jest/globals';

const mockPrisma = {
  cluster: {
    updateMany: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let dissociateClusters: typeof import('./dissociateClusters').dissociateClusters;

beforeAll(async () => {
  ({ dissociateClusters } = await import('./dissociateClusters'));
});

describe('dissociateClusters', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns count 0 if clusterIds array is empty', async () => {
    const result = await dissociateClusters([]);
    expect(result).toEqual({ count: 0 });
    expect(mockPrisma.cluster.updateMany).not.toHaveBeenCalled();
  });

  it('updates clusters setting storyId and storyAngle to null', async () => {
    (mockPrisma.cluster.updateMany as jest.Mock).mockResolvedValue({ count: 2 } as any);

    const result = await dissociateClusters(['c1', 'c2']);
    expect(result).toEqual({ count: 2 });
    expect(mockPrisma.cluster.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c2'] } },
      data: {
        storyId: null,
        storyAngle: null,
      },
    });
  });
});
