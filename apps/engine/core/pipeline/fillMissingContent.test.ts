import { jest } from '@jest/globals';

const mockDb = {
  getArticlesMissingContent: jest.fn(),
  updateArticleContent: jest.fn(),
  isPaywalledSource: jest.fn(),
  markPaywalledArticlesResolved: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

const mockExtractFromHtml = jest.fn();
jest.unstable_mockModule('@extractus/article-extractor', () => ({
  extractFromHtml: mockExtractFromHtml,
  setSanitizeHtmlOptions: jest.fn(),
}));

let fillMissingContent: typeof import('./fillMissingContent').fillMissingContent;

const originalFetch = global.fetch;

beforeAll(async () => {
  ({ fillMissingContent } = await import('./fillMissingContent'));
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('fillMissingContent', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (mockDb.markPaywalledArticlesResolved as jest.Mock).mockResolvedValue(0);
    (mockDb.isPaywalledSource as jest.Mock).mockReturnValue(false);
  });

  it('bulk-resolves backlog paywalled articles on start', async () => {
    (mockDb.markPaywalledArticlesResolved as jest.Mock).mockResolvedValue(12);
    (mockDb.getArticlesMissingContent as jest.Mock).mockResolvedValue([]);

    await fillMissingContent();

    expect(mockDb.markPaywalledArticlesResolved).toHaveBeenCalledTimes(1);
    expect(mockDb.getArticlesMissingContent).toHaveBeenCalledTimes(1);
  });

  it('updates article content on successful extraction', async () => {
    (mockDb.getArticlesMissingContent as jest.Mock).mockResolvedValue([
      {
        id: 'art-1',
        url: 'https://example.com/article1',
        title: 'Article 1',
        source: 'Example News',
      },
    ]);

    global.fetch = jest.fn<any>().mockResolvedValue({
      ok: true,
      text: jest.fn<any>().mockResolvedValue('<html><body>Sample html</body></html>'),
      headers: { get: () => null },
    });

    mockExtractFromHtml.mockResolvedValue({
      content: '<p>Extracted full story content here.</p>',
    });

    await fillMissingContent();

    expect(mockDb.updateArticleContent).toHaveBeenCalledWith(
      'art-1',
      expect.stringContaining('Extracted full story content'),
      undefined
    );
  });

  it('marks article content as empty string on HTTP error (e.g. 403 or 404)', async () => {
    (mockDb.getArticlesMissingContent as jest.Mock).mockResolvedValue([
      {
        id: 'art-403',
        url: 'https://example.com/blocked',
        title: 'Blocked Article',
        source: 'Example News',
      },
    ]);

    global.fetch = jest.fn<any>().mockResolvedValue({
      ok: false,
      status: 403,
    });

    await fillMissingContent();

    expect(mockDb.updateArticleContent).toHaveBeenCalledWith('art-403', '');
  });

  it('marks article content as empty string on network timeout or fetch exception', async () => {
    (mockDb.getArticlesMissingContent as jest.Mock).mockResolvedValue([
      {
        id: 'art-timeout',
        url: 'https://example.com/slow',
        title: 'Slow Article',
        source: 'Example News',
      },
    ]);

    global.fetch = jest.fn<any>().mockRejectedValue(new Error('TimeoutError: signal timed out'));

    await fillMissingContent();

    expect(mockDb.updateArticleContent).toHaveBeenCalledWith('art-timeout', '');
  });

  it('marks article content as empty string when extraction returns no content', async () => {
    (mockDb.getArticlesMissingContent as jest.Mock).mockResolvedValue([
      {
        id: 'art-empty',
        url: 'https://example.com/empty',
        title: 'Empty Article',
        source: 'Example News',
      },
    ]);

    global.fetch = jest.fn<any>().mockResolvedValue({
      ok: true,
      text: jest.fn<any>().mockResolvedValue('<html><body>Empty page</body></html>'),
      headers: { get: () => null },
    });

    mockExtractFromHtml.mockResolvedValue(null);

    await fillMissingContent();

    expect(mockDb.updateArticleContent).toHaveBeenCalledWith('art-empty', '');
  });

  it('skips HTTP fetch and marks paywalled articles with empty string', async () => {
    (mockDb.getArticlesMissingContent as jest.Mock).mockResolvedValue([
      {
        id: 'art-paywall',
        url: 'https://thetimes.com/story',
        title: 'Paywalled Story',
        source: 'The Times',
        sourceRel: { paywalled: true },
      },
    ]);

    (mockDb.isPaywalledSource as jest.Mock).mockReturnValue(true);
    const mockFetch = jest.fn<any>();
    global.fetch = mockFetch;

    await fillMissingContent();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.updateArticleContent).toHaveBeenCalledWith('art-paywall', '');
  });
});
