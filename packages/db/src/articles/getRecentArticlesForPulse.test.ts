import { jest } from '@jest/globals';

const findMany = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    article: {
      findMany,
    },
  },
}));

let getRecentArticlesForPulse: typeof import('./getRecentArticlesForPulse').getRecentArticlesForPulse;

beforeAll(async () => {
  ({ getRecentArticlesForPulse } = await import('./getRecentArticlesForPulse'));
});

describe('getRecentArticlesForPulse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries articles within lookback window and returns mapped records', async () => {
    const mockRows = [
      {
        id: 'art-1',
        title: 'Breaking news event',
        sourceId: 'src-1',
        publishedAt: new Date(),
        embedding: [0.1, 0.2, 0.3],
      },
      {
        id: 'art-2',
        title: 'Non-embedded news',
        sourceId: 'src-2',
        publishedAt: new Date(),
        embedding: null,
      },
    ];
    (findMany as jest.Mock).mockResolvedValue(mockRows);

    const result = await getRecentArticlesForPulse(1);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'art-1',
      title: 'Breaking news event',
      sourceId: 'src-1',
      publishedAt: mockRows[0].publishedAt,
      embedding: [0.1, 0.2, 0.3],
    });
    expect(result[1].embedding).toBeNull();
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
