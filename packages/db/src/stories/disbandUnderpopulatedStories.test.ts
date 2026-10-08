import { jest } from '@jest/globals';

const mockPrisma = {
  cluster: {
    update: jest.fn(),
  },
  story: {
    findMany: jest.fn(),
    delete: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let disbandUnderpopulatedStories: typeof import('./disbandUnderpopulatedStories').disbandUnderpopulatedStories;

beforeAll(async () => {
  ({ disbandUnderpopulatedStories } = await import('./disbandUnderpopulatedStories'));
});

describe('disbandUnderpopulatedStories', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('leaves stories with 2 or more clusters untouched', async () => {
    (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', clusters: [{ id: 'c1' }, { id: 'c2' }] },
    ] as any);

    const result = await disbandUnderpopulatedStories();

    expect(result).toEqual({ disbandedStoriesCount: 0, dissociatedClustersCount: 0 });
    expect(mockPrisma.cluster.update).not.toHaveBeenCalled();
    expect(mockPrisma.story.delete).not.toHaveBeenCalled();
  });

  it('deletes empty stories (0 clusters)', async () => {
    (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([
      { id: 's-empty', clusters: [] },
    ] as any);
    (mockPrisma.story.delete as jest.Mock).mockResolvedValue({ id: 's-empty' } as any);

    const result = await disbandUnderpopulatedStories();

    expect(result).toEqual({ disbandedStoriesCount: 1, dissociatedClustersCount: 0 });
    expect(mockPrisma.cluster.update).not.toHaveBeenCalled();
    expect(mockPrisma.story.delete).toHaveBeenCalledWith({ where: { id: 's-empty' } });
  });

  it('dissociates single cluster and deletes 1-cluster story', async () => {
    (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([
      { id: 's-single', clusters: [{ id: 'c-lone' }] },
    ] as any);
    (mockPrisma.cluster.update as jest.Mock).mockResolvedValue({} as any);
    (mockPrisma.story.delete as jest.Mock).mockResolvedValue({ id: 's-single' } as any);

    const result = await disbandUnderpopulatedStories();

    expect(result).toEqual({ disbandedStoriesCount: 1, dissociatedClustersCount: 1 });
    expect(mockPrisma.cluster.update).toHaveBeenCalledWith({
      where: { id: 'c-lone' },
      data: { storyId: null, storyAngle: null },
    });
    expect(mockPrisma.story.delete).toHaveBeenCalledWith({ where: { id: 's-single' } });
  });
});
