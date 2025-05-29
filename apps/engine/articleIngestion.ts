// Article ingestion service for Neus backend engine
// Fetches articles from RSS feeds (initial version)
// TODO: Add scraping and more robust error handling

import { Article } from '../../packages/types/article';
import { fetch } from './fetcher';

export async function fetchArticlesFromRss(feedUrl: string): Promise<Article[]> {
  // Use fetcher for RSS requests to support proxy/debug
  const Parser = (await import('rss-parser')).default;
  const parser = new Parser();
  // Patch global fetch for rss-parser
  const origFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = fetch;
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || []).map(item => ({
      title: item.title || '',
      url: item.link || '',
      source: feed.title || '',
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      content: item.contentSnippet || item.content || '',
      author: item.creator || item.author || undefined,
      // TODO: Add more fields as needed
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
