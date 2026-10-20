import { jest } from '@jest/globals';

const count = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    article: {
      count,
    },
  },
}));

let countUnclusteredArticles: typeof import('./countUnclusteredArticles').countUnclusteredArticles;

beforeAll(async () => {
  ({ countUnclusteredArticles } = await import('./countUnclusteredArticles'));
});

describe('countUnclusteredArticles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to 3-day lookback window and returns article count', async () => {
    (count as jest.Mock).mockResolvedValue(42);
    const beforeCall = Date.now();

    const result = await countUnclusteredArticles();

    expect(result).toBe(42);
    expect(count).toHaveBeenCalledTimes(1);
    const query = (count as jest.Mock).mock.calls[0][0] as any;
    expect(query.where.clusterAssignments).toEqual({ none: {} });
    const cutoff = query.where.createdAt.gte as Date;
    const daysDiff = (beforeCall - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeCloseTo(3, 1);
  });

  it('accepts a custom lookback window in days', async () => {
    (count as jest.Mock).mockResolvedValue(10);
    const beforeCall = Date.now();

    const result = await countUnclusteredArticles(7);

    expect(result).toBe(10);
    const query = (count as jest.Mock).mock.calls[0][0] as any;
    const cutoff = query.where.createdAt.gte as Date;
    const daysDiff = (beforeCall - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeCloseTo(7, 1);
  });
});
