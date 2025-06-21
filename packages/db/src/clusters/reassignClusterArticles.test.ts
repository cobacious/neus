import { jest } from '@jest/globals';

const updateMany = jest.fn();
jest.unstable_mockModule('../client', () => ({ prisma: { articleClusterAssignment: { updateMany } } }));

let reassignClusterArticles: typeof import('./reassignClusterArticles').reassignClusterArticles;

beforeAll(async () => {
  ({ reassignClusterArticles } = await import('./reassignClusterArticles'));
});

describe('reassignClusterArticles', () => {
  it('moves assignments to the new cluster', async () => {
    updateMany.mockResolvedValue({});
    await reassignClusterArticles('c1', 'c2');
    expect(updateMany).toHaveBeenCalledWith({
      where: { clusterId: 'c1' },
      data: { clusterId: 'c2' },
    });
  });
});
