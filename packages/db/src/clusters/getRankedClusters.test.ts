import { jest } from '@jest/globals';

const findMany = jest.fn();
jest.unstable_mockModule('../client', () => ({ prisma: { cluster: { findMany } } }));

let getRankedClusters: typeof import('./getRankedClusters').getRankedClusters;

beforeAll(async () => {
  ({ getRankedClusters } = await import('./getRankedClusters'));
});

describe('getRankedClusters', () => {
  it('requests clusters ordered by score', async () => {
    findMany.mockResolvedValue([]);
    await getRankedClusters();
    expect(findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { headline: { not: null } },
          { headline: { not: '' } },
          { summary: { not: null } },
          { summary: { not: '' } },
          { archived: false },
        ],
      },
      include: {
        articleAssignments: {
          select: {
            createdAt: true,
            article: {
              select: {
                id: true,
                url: true,
                title: true,
                source: true,
                publishedAt: true,
                author: true,
                sourceRel: {
                  select: {
                    id: true,
                    name: true,
                    faviconUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { score: 'desc' },
    });
  });
});
