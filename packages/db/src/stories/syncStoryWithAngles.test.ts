import { jest } from '@jest/globals';

const mockPrisma = {
  cluster: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  story: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let syncStoryWithAngles: typeof import('./syncStoryWithAngles').syncStoryWithAngles;

beforeAll(async () => {
  ({ syncStoryWithAngles } = await import('./syncStoryWithAngles'));
});

describe('syncStoryWithAngles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns null if angles array is empty', async () => {
    const res = await syncStoryWithAngles({
      storyTitle: 'Test Story',
      angles: [],
    });
    expect(res).toBeNull();
  });

  it('creates a new story and associates clusters when no story exists', async () => {
    (mockPrisma.cluster.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', storyId: null },
      { id: 'c2', storyId: null },
    ] as any);

    (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.story.create as jest.Mock).mockResolvedValue({
      id: 'story-1',
      title: 'Botched Execution',
      slug: 'botched-execution',
      overview: 'An overview',
      status: 'developing',
    } as any);

    (mockPrisma.cluster.update as jest.Mock).mockResolvedValue({} as any);

    const result = await syncStoryWithAngles({
      storyTitle: 'Botched Execution',
      status: 'developing',
      overview: 'An overview',
      angles: [
        { clusterId: 'c1', angle: 'The Attempt' },
        { clusterId: 'c2', angle: 'The Fallout' },
      ],
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe('story-1');
    expect(mockPrisma.story.create).toHaveBeenCalledWith({
      data: {
        title: 'Botched Execution',
        slug: 'botched-execution',
        overview: 'An overview',
        status: 'developing',
      },
    });

    expect(mockPrisma.cluster.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.cluster.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { storyId: 'story-1', storyAngle: 'The Attempt' },
    });
    expect(mockPrisma.cluster.update).toHaveBeenCalledWith({
      where: { id: 'c2' },
      data: { storyId: 'story-1', storyAngle: 'The Fallout' },
    });
  });

  it('updates an existing story when one of the clusters already has a storyId', async () => {
    (mockPrisma.cluster.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', storyId: 'existing-story-id' },
      { id: 'c3', storyId: null },
    ] as any);

    (mockPrisma.story.update as jest.Mock).mockResolvedValue({
      id: 'existing-story-id',
      title: 'Updated Story Title',
      overview: 'Updated overview',
      status: 'developing',
    } as any);

    (mockPrisma.cluster.update as jest.Mock).mockResolvedValue({} as any);

    const result = await syncStoryWithAngles({
      storyTitle: 'Updated Story Title',
      overview: 'Updated overview',
      angles: [
        { clusterId: 'c1', angle: 'The Attempt' },
        { clusterId: 'c3', angle: 'Hospital Recovery' },
      ],
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe('existing-story-id');
    expect(mockPrisma.story.update).toHaveBeenCalledWith({
      where: { id: 'existing-story-id' },
      data: {
        title: 'Updated Story Title',
        overview: 'Updated overview',
        status: 'developing',
      },
    });
    expect(mockPrisma.story.create).not.toHaveBeenCalled();

    expect(mockPrisma.cluster.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.cluster.update).toHaveBeenCalledWith({
      where: { id: 'c3' },
      data: { storyId: 'existing-story-id', storyAngle: 'Hospital Recovery' },
    });
  });

  it('updates an existing story when existingStoryId is explicitly provided with embedding', async () => {
    (mockPrisma.story.update as jest.Mock).mockResolvedValue({
      id: 'dormant-story-id',
      title: 'Reactivated Story',
      status: 'developing',
    } as any);

    (mockPrisma.cluster.update as jest.Mock).mockResolvedValue({} as any);

    const result = await syncStoryWithAngles({
      existingStoryId: 'dormant-story-id',
      storyTitle: 'Reactivated Story',
      status: 'developing',
      embedding: [0.1, 0.2],
      angles: [{ clusterId: 'c9', angle: 'New Angle' }],
    });

    expect(result?.id).toBe('dormant-story-id');
    expect(mockPrisma.story.update).toHaveBeenCalledWith({
      where: { id: 'dormant-story-id' },
      data: {
        title: 'Reactivated Story',
        overview: undefined,
        status: 'developing',
        embedding: [0.1, 0.2],
      },
    });
    expect(mockPrisma.cluster.findMany).not.toHaveBeenCalled();
  });

  it('detaches clusters that were previously in the story but are not in the new angles', async () => {
    (mockPrisma.story.update as jest.Mock).mockResolvedValue({
      id: 'story-existing',
      title: 'Updated Story',
      status: 'developing',
    } as any);

    (mockPrisma.cluster.update as jest.Mock).mockResolvedValue({} as any);
    (mockPrisma.cluster.updateMany as jest.Mock).mockResolvedValue({ count: 1 } as any);

    await syncStoryWithAngles({
      existingStoryId: 'story-existing',
      storyTitle: 'Updated Story',
      angles: [{ clusterId: 'c1', angle: 'Angle 1' }],
    });

    expect(mockPrisma.cluster.updateMany).toHaveBeenCalledWith({
      where: {
        storyId: 'story-existing',
        id: { notIn: ['c1'] },
      },
      data: {
        storyId: null,
        storyAngle: null,
      },
    });
  });
});
