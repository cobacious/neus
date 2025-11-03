// Article ingestion service for Neus backend engine
import Parser from 'rss-parser';

// RSS category can be a string or an object with attributes (e.g., domain)
// See RSS 2.0 spec: <category domain="...">Category Text</category>
// rss-parser returns these as: { _: "Category Text", $: { domain: "..." } }
type RssCategory = string | { _: string; $?: { domain?: string } };

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

/**
 * Normalize RSS categories to plain strings.
 * Some feeds (e.g., Guardian) use category attributes which rss-parser
 * parses as objects with _ (text) and $ (attributes) properties.
 */
function normalizeCategories(categories?: RssCategory[]): string[] | undefined {
  if (!categories || categories.length === 0) return undefined;
  return categories.map(cat => typeof cat === 'string' ? cat : cat._);
}

export async function fetchArticlesFromRss(feedUrl: string): Promise<RssArticle[]> {
  const parser = new Parser();

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
    categories: normalizeCategories(item.categories),
  }));
}
