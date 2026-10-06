import { jest } from '@jest/globals';
import { Prisma } from '@prisma/client';

const clusterUpdateMany = jest.fn();
const articleUpdateMany = jest.fn();

jest.unstable_mockModule('../client', () => ({
  prisma: {
    cluster: {
      updateMany: clusterUpdateMany,
    },
    article: {
      updateMany: articleUpdateMany,
    },
  },
}));

let pruneArchivedClusterPayloads: typeof import('./pruneArchivedClusterPayloads').pruneArchivedClusterPayloads;

beforeAll(async () => {
  ({ pruneArchivedClusterPayloads } = await import('./pruneArchivedClusterPayloads'));
});

describe('pruneArchivedClusterPayloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prunes embeddings on archived clusters and heavy fields on their articles', async () => {
    clusterUpdateMany.mockResolvedValue({ count: 12 });
    articleUpdateMany.mockResolvedValue({ count: 45 });

    const result = await pruneArchivedClusterPayloads();

    expect(result).toEqual({
      clustersPruned: 12,
      articlesPruned: 45,
    });

    expect(clusterUpdateMany).toHaveBeenCalledWith({
      where: {
        archived: true,
        embedding: { not: Prisma.DbNull },
      },
      data: {
        embedding: Prisma.DbNull,
      },
    });

    expect(articleUpdateMany).toHaveBeenCalledWith({
      where: {
        clusterAssignments: {
          some: {
            cluster: {
              archived: true,
            },
          },
        },
        OR: [
          { embedding: { not: Prisma.DbNull } },
          { content: { not: null } },
          { rawHtml: { not: null } },
        ],
      },
      data: {
        embedding: Prisma.DbNull,
        content: null,
        rawHtml: null,
      },
    });
  });

  it('returns zeros when nothing to prune', async () => {
    clusterUpdateMany.mockResolvedValue({ count: 0 });
    articleUpdateMany.mockResolvedValue({ count: 0 });

    const result = await pruneArchivedClusterPayloads();

    expect(result).toEqual({
      clustersPruned: 0,
      articlesPruned: 0,
    });
  });
});
