import { jest } from '@jest/globals';

const findMany = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    article: {
      findMany,
    },
  },
}));

let getUnclusteredArticles: typeof import('./getUnclusteredArticles').getUnclusteredArticles;

beforeAll(async () => {
  ({ getUnclusteredArticles } = await import('./getUnclusteredArticles'));
});

describe('getUnclusteredArticles', () => {
  const originalEnv = process.env.UNCLUSTERED_LOOKBACK_DAYS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.UNCLUSTERED_LOOKBACK_DAYS;
  });

  afterAll(() => {
    process.env.UNCLUSTERED_LOOKBACK_DAYS = originalEnv;
  });

  it('defaults to 3-day lookback window', async () => {
    findMany.mockResolvedValue([]);
    const beforeCall = Date.now();

    await getUnclusteredArticles();

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0][0] as any;
    const cutoff = query.where.createdAt.gte as Date;
    const daysDiff = (beforeCall - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeCloseTo(3, 1);
  });

  it('respects custom daysBack parameter', async () => {
    findMany.mockResolvedValue([]);
    const beforeCall = Date.now();

    await getUnclusteredArticles(5);

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0][0] as any;
    const cutoff = query.where.createdAt.gte as Date;
    const daysDiff = (beforeCall - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeCloseTo(5, 1);
  });

  it('respects UNCLUSTERED_LOOKBACK_DAYS environment variable', async () => {
    process.env.UNCLUSTERED_LOOKBACK_DAYS = '2';
    findMany.mockResolvedValue([]);
    const beforeCall = Date.now();

    await getUnclusteredArticles();

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0][0] as any;
    const cutoff = query.where.createdAt.gte as Date;
    const daysDiff = (beforeCall - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeCloseTo(2, 1);
  });
});
