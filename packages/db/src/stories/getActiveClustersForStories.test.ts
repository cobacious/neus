import { jest } from '@jest/globals';

const findMany = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    cluster: { findMany },
  },
}));

let getActiveClustersForStories: typeof import('./getActiveClustersForStories').getActiveClustersForStories;

beforeAll(async () => {
  ({ getActiveClustersForStories } = await import('./getActiveClustersForStories'));
});

describe('getActiveClustersForStories', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches unarchived clusters with headlines and summaries within the cutoff date', async () => {
    findMany.mockResolvedValue([
      { id: 'c1', headline: 'H1', summary: 'S1', storyId: null },
    ] as any);

    const res = await getActiveClustersForStories(7);

    expect(res).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archived: false,
          headline: { not: null },
          summary: { not: null },
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});
