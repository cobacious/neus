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
      include: {
        articleAssignments: {
          include: {
            article: { include: { sourceRel: true } },
          },
        },
      },
      orderBy: { score: 'desc' },
    });
  });
});
