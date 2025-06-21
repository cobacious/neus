import { jest } from '@jest/globals';

const update = jest.fn();
jest.unstable_mockModule('../client', () => ({ prisma: { cluster: { update } } }));

let updateClusterEmbedding: typeof import('./updateClusterEmbedding').updateClusterEmbedding;

beforeAll(async () => {
  ({ updateClusterEmbedding } = await import('./updateClusterEmbedding'));
});

describe('updateClusterEmbedding', () => {
  it('updates the cluster embedding', async () => {
    update.mockResolvedValue({});
    const embedding = [0.1, 0.2];
    await updateClusterEmbedding('c1', embedding);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { embedding },
    });
  });
});
