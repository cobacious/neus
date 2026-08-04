import { jest } from '@jest/globals';

const findMany = jest.fn();
const updateMany = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    cluster: {
      findMany,
      updateMany,
    },
  },
}));

let archiveOldClusters: typeof import('./archiveOldClusters').archiveOldClusters;

beforeAll(async () => {
  ({ archiveOldClusters } = await import('./archiveOldClusters'));
});

describe('archiveOldClusters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 when no old clusters found', async () => {
    findMany.mockResolvedValue([]);
    const count = await archiveOldClusters(30);
    expect(count).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('archives old clusters when found', async () => {
    findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    updateMany.mockResolvedValue({ count: 2 });

    const count = await archiveOldClusters(30);

    expect(count).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['c1', 'c2'],
        },
      },
      data: {
        archived: true,
      },
    });
  });
});
