import { jest } from '@jest/globals';

const mockPrisma = {
  story: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let markDormantStories: typeof import('./markDormantStories').markDormantStories;

beforeAll(async () => {
  ({ markDormantStories } = await import('./markDormantStories'));
});

describe('markDormantStories', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 0 if no stories are eligible for dormancy', async () => {
    const recentDate = new Date();
    (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([
      {
        id: 's1',
        clusters: [{ createdAt: recentDate, archived: false }],
      },
    ] as any);

    const count = await markDormantStories(7);

    expect(count).toBe(0);
    expect(mockPrisma.story.updateMany).not.toHaveBeenCalled();
  });

  it('marks stories as dormant if all clusters are older than cutoff or archived', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);

    const recentDate = new Date();

    (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([
      {
        id: 's-dormant',
        clusters: [
          { createdAt: oldDate, archived: false },
          { createdAt: recentDate, archived: true }, // archived doesn't count as active
        ],
      },
      {
        id: 's-active',
        clusters: [
          { createdAt: recentDate, archived: false },
        ],
      },
    ] as any);

    (mockPrisma.story.updateMany as jest.Mock).mockResolvedValue({ count: 1 } as any);

    const count = await markDormantStories(7);

    expect(count).toBe(1);
    expect(mockPrisma.story.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['s-dormant'] } },
      data: { status: 'dormant' },
    });
  });
});
