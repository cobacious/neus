import Parser from 'rss-parser';
import { fetchArticlesFromRss } from './articleIngestion';

describe('fetchArticlesFromRss', () => {
  const originalParse = (Parser.prototype as any).parseURL;

  afterEach(() => {
    // restore original method
    (Parser.prototype as any).parseURL = originalParse;
  });

  it('maps feed items to RssArticle shape (happy path)', async () => {
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
    } as any;

    // stub parseURL to return our feed
    (Parser.prototype as any).parseURL = async function () {
      return feed;
    };

    const articles = await fetchArticlesFromRss('http://fake');

    expect(articles).toHaveLength(1);
    const a = articles[0];
    expect(a.title).toBe('News title');
    expect(a.url).toBe('https://example.com/news/1');
    expect(a.source).toBe('Example Feed');
    expect(a.publishedAt).toBe('2020-01-01T12:00:00.000Z');
    expect(a.snippet).toBe('Short summary');
    // content is intentionally set to undefined by the function
    expect(a.content).toBeUndefined();
    expect(a.author).toBe('Reporter');
    expect(a.guid).toBe('guid-1');
    expect(a.categories).toEqual(['world', 'politics']);
  });

  it('falls back to content when contentSnippet is missing and creator->author fallback works', async () => {
    const feed = {
      title: 'Other Feed',
      items: [
        {
          title: 'Other',
          link: 'https://example.com/other',
          pubDate: '2001-01-01T00:00:00.000Z',
          // no contentSnippet, but content present
          content: 'Full text here',
          // no creator, but author present
          author: 'Byline',
          guid: 'g-2',
        },
      ],
    } as any;

    (Parser.prototype as any).parseURL = async function () {
      return feed;
    };

    const articles = await fetchArticlesFromRss('http://fake');

    expect(articles).toHaveLength(1);
    const a = articles[0];
    expect(a.snippet).toBe('Full text here');
    expect(a.author).toBe('Byline');
    expect(a.publishedAt).toBe('2001-01-01T00:00:00.000Z');
  });

  it('handles categories with domain attributes (Guardian-style RSS)', async () => {
    const feed = {
      title: 'Guardian Feed',
      items: [
        {
          title: 'News article',
          link: 'https://example.com/article',
          isoDate: '2025-11-03T12:00:00.000Z',
          contentSnippet: 'Article summary',
          // Guardian-style categories with domain attributes
          categories: [
            { _: 'UK news', $: { domain: 'https://www.theguardian.com/uk/uk' } },
            { _: 'Rail transport', $: { domain: 'https://www.theguardian.com/uk/rail-transport' } },
          ],
        },
      ],
    } as any;

    (Parser.prototype as any).parseURL = async function () {
      return feed;
    };

    const articles = await fetchArticlesFromRss('http://fake');

    expect(articles).toHaveLength(1);
    const a = articles[0];
    expect(a.categories).toEqual(['UK news', 'Rail transport']);
  });

  it('handles mixed string and object categories', async () => {
    const feed = {
      title: 'Mixed Feed',
      items: [
        {
          title: 'Mixed article',
          link: 'https://example.com/mixed',
          isoDate: '2025-11-03T12:00:00.000Z',
          contentSnippet: 'Mixed categories',
          // Some feeds might have a mix
          categories: [
            'simple-category',
            { _: 'Complex category', $: { domain: 'https://example.com' } },
          ],
        },
      ],
    } as any;

    (Parser.prototype as any).parseURL = async function () {
      return feed;
    };

    const articles = await fetchArticlesFromRss('http://fake');

    expect(articles).toHaveLength(1);
    const a = articles[0];
    expect(a.categories).toEqual(['simple-category', 'Complex category']);
  });
});
