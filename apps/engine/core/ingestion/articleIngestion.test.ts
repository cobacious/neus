import { jest } from '@jest/globals';
import Parser from 'rss-parser';
import {
  fetchArticlesFromRss,
  parseFeedItems,
  getFallbackFeedUrl,
  DEFAULT_FEED_FETCH_HEADERS,
} from './articleIngestion';

describe('articleIngestion', () => {
  const originalFetch = global.fetch;
  const originalParseString = (Parser.prototype as any).parseString;

  afterEach(() => {
    global.fetch = originalFetch;
    (Parser.prototype as any).parseString = originalParseString;
  });

  describe('parseFeedItems', () => {
    it('maps feed items to RssArticle shape (happy path)', () => {
      const feed = {
        title: 'Example Feed',
        items: [
          {
            title: 'News title',
            link: 'https://example.com/news/1',
            isoDate: '2020-01-01T12:00:00.000Z',
            contentSnippet: 'Short summary',
            content: '<p>Full content</p>',
            creator: 'Reporter',
            guid: 'guid-1',
            categories: ['world', 'politics'],
          },
        ],
      };

      const articles = parseFeedItems(feed);

      expect(articles).toHaveLength(1);
      const a = articles[0];
      expect(a.title).toBe('News title');
      expect(a.url).toBe('https://example.com/news/1');
      expect(a.source).toBe('Example Feed');
      expect(a.publishedAt).toBe('2020-01-01T12:00:00.000Z');
      expect(a.snippet).toBe('Short summary');
      expect(a.content).toBeUndefined();
      expect(a.author).toBe('Reporter');
      expect(a.guid).toBe('guid-1');
      expect(a.categories).toEqual(['world', 'politics']);
    });

    it('falls back to content when contentSnippet is missing and creator->author fallback works', () => {
      const feed = {
        title: 'Other Feed',
        items: [
          {
            title: 'Other',
            link: 'https://example.com/other',
            pubDate: '2001-01-01T00:00:00.000Z',
            content: 'Full text here',
            author: 'Byline',
            guid: 'g-2',
          },
        ],
      };

      const articles = parseFeedItems(feed);

      expect(articles).toHaveLength(1);
      const a = articles[0];
      expect(a.snippet).toBe('Full text here');
      expect(a.author).toBe('Byline');
      expect(a.publishedAt).toBe('2001-01-01T00:00:00.000Z');
    });

    it('handles categories with domain attributes (Guardian-style RSS)', () => {
      const feed = {
        title: 'Guardian Feed',
        items: [
          {
            title: 'News article',
            link: 'https://example.com/article',
            isoDate: '2025-11-03T12:00:00.000Z',
            contentSnippet: 'Article summary',
            categories: [
              { _: 'UK news', $: { domain: 'https://www.theguardian.com/uk/uk' } },
              { _: 'Rail transport', $: { domain: 'https://www.theguardian.com/uk/rail-transport' } },
            ],
          },
        ],
      };

      const articles = parseFeedItems(feed);

      expect(articles).toHaveLength(1);
      const a = articles[0];
      expect(a.categories).toEqual(['UK news', 'Rail transport']);
    });

    it('handles mixed string and object categories', () => {
      const feed = {
        title: 'Mixed Feed',
        items: [
          {
            title: 'Mixed article',
            link: 'https://example.com/mixed',
            isoDate: '2025-11-03T12:00:00.000Z',
            contentSnippet: 'Mixed categories',
            categories: [
              'simple-category',
              { _: 'Complex category', $: { domain: 'https://example.com' } },
            ],
          },
        ],
      };

      const articles = parseFeedItems(feed);

      expect(articles).toHaveLength(1);
      const a = articles[0];
      expect(a.categories).toEqual(['simple-category', 'Complex category']);
    });
  });

  describe('getFallbackFeedUrl', () => {
    it('generates Google News RSS search URL for standard domain', () => {
      expect(getFallbackFeedUrl('https://www.express.co.uk/posts/rss/1/news')).toBe(
        'https://news.google.com/rss/search?q=when:24h+site:express.co.uk&hl=en-GB&gl=GB&ceid=GB:en'
      );
    });

    it('returns null if already a Google News RSS search URL', () => {
      expect(
        getFallbackFeedUrl(
          'https://news.google.com/rss/search?q=when:24h+site:thetimes.com&hl=en-GB&gl=GB&ceid=GB:en'
        )
      ).toBeNull();
    });

    it('returns null for invalid URLs', () => {
      expect(getFallbackFeedUrl('not-a-url')).toBeNull();
    });
  });

  describe('fetchArticlesFromRss', () => {
    it('fetches and parses feed with default headers', async () => {
      const mockXml = '<rss><channel><title>Test Feed</title></channel></rss>';
      const mockFeed = {
        title: 'Test Feed',
        items: [
          {
            title: 'Sample Headline',
            link: 'https://example.com/headline',
            isoDate: '2026-10-09T12:00:00.000Z',
            contentSnippet: 'Snippet',
          },
        ],
      };

      let requestedUrl = '';
      let requestedHeaders: any = {};
      global.fetch = jest.fn().mockImplementation(async (url, init) => {
        requestedUrl = url;
        requestedHeaders = init?.headers;
        return {
          ok: true,
          status: 200,
          text: async () => mockXml,
        };
      });

      (Parser.prototype as any).parseString = jest.fn().mockResolvedValue(mockFeed);

      const articles = await fetchArticlesFromRss('https://example.com/rss');

      expect(requestedUrl).toBe('https://example.com/rss');
      expect(requestedHeaders).toEqual(DEFAULT_FEED_FETCH_HEADERS);
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Sample Headline');
      expect(articles[0].source).toBe('Test Feed');
    });

    it('falls back to Google News RSS search on HTTP 403 Forbidden', async () => {
      const fallbackXml = '<rss><channel><title>Google News</title></channel></rss>';
      const fallbackFeed = {
        title: 'Daily Express',
        items: [
          {
            title: 'Express Headline - Daily Express',
            link: 'https://news.google.com/articles/123',
            isoDate: '2026-10-09T14:00:00.000Z',
            contentSnippet: 'Fallback snippet',
          },
        ],
      };

      const fetchMock = jest.fn().mockImplementation(async (url: string) => {
        if (url === 'https://www.express.co.uk/posts/rss/1/news') {
          return {
            ok: false,
            status: 403,
            statusText: 'Forbidden',
          };
        }
        if (url.includes('news.google.com')) {
          return {
            ok: true,
            status: 200,
            text: async () => fallbackXml,
          };
        }
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      global.fetch = fetchMock;
      (Parser.prototype as any).parseString = jest.fn().mockResolvedValue(fallbackFeed);

      const articles = await fetchArticlesFromRss('https://www.express.co.uk/posts/rss/1/news');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Express Headline - Daily Express');
    });

    it('falls back to Google News RSS search on XML parse failure', async () => {
      const fallbackFeed = {
        title: 'Recovered Feed',
        items: [
          {
            title: 'Recovered Story',
            link: 'https://example.com/story',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<html>Not XML</html>',
      });

      let callCount = 0;
      (Parser.prototype as any).parseString = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Non-whitespace before first tag');
        }
        return fallbackFeed;
      });

      const articles = await fetchArticlesFromRss('https://www.independent.co.uk/news/rss');

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Recovered Story');
    });

    it('rethrows primary error when both primary and fallback fail', async () => {
      global.fetch = jest.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        };
      });

      await expect(
        fetchArticlesFromRss('https://www.example.com/rss')
      ).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });
});
