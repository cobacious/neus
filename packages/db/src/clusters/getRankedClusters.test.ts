import { jest } from '@jest/globals';

const findMany = jest.fn();
jest.unstable_mockModule('../client', () => ({ prisma: { cluster: { findMany } } }));
const scoreFn = jest.fn();
jest.unstable_mockModule('./scoreCluster', () => ({ scoreCluster: scoreFn }));

let getRankedClusters: typeof import('./getRankedClusters').getRankedClusters;

beforeAll(async () => {
  ({ getRankedClusters } = await import('./getRankedClusters'));
});

describe('getRankedClusters', () => {
  it('sorts clusters by score', async () => {
    findMany.mockResolvedValue([
      { id: '1', articleAssignments: [] },
      { id: '2', articleAssignments: [] },
    ]);
    scoreFn.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    const clusters = await getRankedClusters();
    expect(clusters[0].id).toBe('2');
  });
});
