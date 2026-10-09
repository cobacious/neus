import { jest } from '@jest/globals';

const mockPrisma = {
  story: {
    findMany: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let getStoriesForMatching: typeof import('./getStoriesForMatching').getStoriesForMatching;

beforeAll(async () => {
  ({ getStoriesForMatching } = await import('./getStoriesForMatching'));
});

describe('getStoriesForMatching', () => {
  it('calls prisma.story.findMany with expected fields', async () => {
    (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', title: 'Story 1', status: 'developing' },
    ] as any);

    const res = await getStoriesForMatching();

    expect(res).toHaveLength(1);
    expect(mockPrisma.story.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        title: true,
        slug: true,
        overview: true,
        status: true,
        embedding: true,
        updatedAt: true,
        _count: {
          select: { clusters: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  });
});
