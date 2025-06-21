// Article ingestion service for Neus backend engine
// Fetches articles from RSS feeds (initial version)

import { fetch } from '../../lib/fetcher';

export type RssArticle = {
  title: string;
  url: string;
  source: string;
  sourceId?: string;
  publishedAt: string;
  updatedAt?: string;
  snippet: string;
  content?: string;
  author?: string;
  guid?: string;
  categories?: string[];
};

export async function fetchArticlesFromRss(feedUrl: string): Promise<RssArticle[]> {
  // Use fetcher for RSS requests to support proxy/debug
  const Parser = (await import('rss-parser')).default;
  const parser = new Parser();
  // Patch global fetch for rss-parser
  const origFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = fetch;
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || []).map((item) => ({
      title: item.title || '',
      url: item.link || '',
      source: feed.title || '',
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      snippet: item.contentSnippet || item.content || '', // Store RSS summary/snippet here
      content: undefined, // Full content will be extracted later
      author: item.creator || item.author || undefined,
      guid: item.guid,
      categories: item.categories,
    }));
  } finally {
    (globalThis as any).fetch = origFetch;
  }
}

// Example usage (for dev/testing):
// (async () => {
//   const articles = await fetchArticlesFromRss('https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml');
//   console.log(articles);
// })();
