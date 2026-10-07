import { jest } from '@jest/globals';

const mockDb = {
  syncArticles: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

let storeArticles: typeof import('./storeArticles').storeArticles;

beforeAll(async () => {
  ({ storeArticles } = await import('./storeArticles'));
});

describe('storeArticles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters out invalid articles and calls syncArticles', async () => {
    (mockDb.syncArticles as jest.Mock).mockResolvedValue({
      created: 1,
      updated: 0,
      unchanged: 0,
    } as any);

    await storeArticles([
      {
        url: '',
        title: 'Missing URL',
        source: 'S1',
        publishedAt: new Date().toISOString(),
        snippet: 'snippet',
      },
      {
        url: 'https://example.com/valid',
        title: 'Valid Story',
        source: 'S1',
        sourceId: 'src-1',
        publishedAt: new Date().toISOString(),
        snippet: 'snippet',
      },
    ]);

    expect(mockDb.syncArticles).toHaveBeenCalledTimes(1);
    expect(mockDb.syncArticles).toHaveBeenCalledWith([
      expect.objectContaining({
        url: 'https://example.com/valid',
        title: 'Valid Story',
      }),
    ]);
  });
});
