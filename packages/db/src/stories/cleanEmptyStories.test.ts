import { jest } from '@jest/globals';

const mockPrisma = {
  story: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let cleanEmptyStories: typeof import('./cleanEmptyStories').cleanEmptyStories;

beforeAll(async () => {
  ({ cleanEmptyStories } = await import('./cleanEmptyStories'));
});

describe('cleanEmptyStories', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 0 when no empty stories exist', async () => {
    (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

    const result = await cleanEmptyStories();

    expect(result).toEqual({ deletedStoriesCount: 0 });
    expect(mockPrisma.story.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes empty stories when found', async () => {
    (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([
      { id: 's-empty-1' },
      { id: 's-empty-2' },
    ] as any);
    (mockPrisma.story.deleteMany as jest.Mock).mockResolvedValue({ count: 2 } as any);

    const result = await cleanEmptyStories();

    expect(result).toEqual({ deletedStoriesCount: 2 });
    expect(mockPrisma.story.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['s-empty-1', 's-empty-2'] } },
    });
  });
});
