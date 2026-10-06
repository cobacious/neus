import { jest } from '@jest/globals';

const deleteMany = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    article: {
      deleteMany,
    },
  },
}));

let deleteOldUnclusteredArticles: typeof import('./deleteOldUnclusteredArticles').deleteOldUnclusteredArticles;

beforeAll(async () => {
  ({ deleteOldUnclusteredArticles } = await import('./deleteOldUnclusteredArticles'));
});

describe('deleteOldUnclusteredArticles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes unclustered articles older than cutoff', async () => {
    deleteMany.mockResolvedValue({ count: 5 });

    const count = await deleteOldUnclusteredArticles(7);

    expect(count).toBe(5);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        clusterAssignments: {
          none: {},
        },
        createdAt: {
          lt: expect.any(Date),
        },
      },
    });
  });

  it('returns 0 when no articles match', async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    const count = await deleteOldUnclusteredArticles();

    expect(count).toBe(0);
    expect(deleteMany).toHaveBeenCalled();
  });
});
