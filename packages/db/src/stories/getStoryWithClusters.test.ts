import { jest } from '@jest/globals';

const mockPrisma = {
  story: {
    findUnique: jest.fn(),
  },
  cluster: {
    findUnique: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let getStoryById: typeof import('./getStoryWithClusters').getStoryById;
let getStoryBySlug: typeof import('./getStoryWithClusters').getStoryBySlug;
let getClusterWithStory: typeof import('./getStoryWithClusters').getClusterWithStory;

beforeAll(async () => {
  ({ getStoryById, getStoryBySlug, getClusterWithStory } = await import('./getStoryWithClusters'));
});

describe('getStoryWithClusters', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches story by id with chronological clusters', async () => {
    (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      title: 'Story 1',
      clusters: [{ id: 'c1' }, { id: 'c2' }],
    } as any);

    const res = await getStoryById('s1');
    expect(res?.id).toBe('s1');
    expect(mockPrisma.story.findUnique).toHaveBeenCalledWith({
      where: { id: 's1' },
      include: {
        clusters: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });

  it('fetches story by slug', async () => {
    (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      slug: 'story-1',
    } as any);

    const res = await getStoryBySlug('story-1');
    expect(res?.slug).toBe('story-1');
    expect(mockPrisma.story.findUnique).toHaveBeenCalledWith({
      where: { slug: 'story-1' },
      include: {
        clusters: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });

  it('fetches cluster with its parent story and sister clusters', async () => {
    (mockPrisma.cluster.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1',
      story: {
        id: 's1',
        clusters: [{ id: 'c1' }, { id: 'c2' }],
      },
    } as any);

    const res = await getClusterWithStory('c1');
    expect(res?.story?.id).toBe('s1');
    expect(mockPrisma.cluster.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      include: {
        story: {
          include: {
            clusters: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
  });
});
