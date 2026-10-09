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

export const DEFAULT_FEED_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; NeusFeedReader/1.0; +https://neus.news)',
  Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

export function getFallbackFeedUrl(feedUrl: string): string | null {
  try {
    const parsed = new URL(feedUrl);
    // Don't fallback if already a Google News RSS search
    if (parsed.hostname.includes('google.com')) return null;
    const domain = parsed.hostname.replace(/^www\./, '');
    return `https://news.google.com/rss/search?q=when:24h+site:${domain}&hl=en-GB&gl=GB&ceid=GB:en`;
  } catch {
    return null;
  }
}

export function parseFeedItems(feed: { title?: string; items?: any[] }): RssArticle[] {
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

export async function fetchArticlesFromRss(feedUrl: string, timeoutMs = 15000): Promise<RssArticle[]> {
  const parser = new Parser();

  const fetchFeedXml = async (url: string): Promise<string> => {
    const res = await fetch(url, {
      headers: DEFAULT_FEED_FETCH_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.text();
  };

  try {
    const xmlText = await fetchFeedXml(feedUrl);
    const feed = await parser.parseString(xmlText);
    return parseFeedItems(feed);
  } catch (primaryErr: any) {
    const fallbackUrl = getFallbackFeedUrl(feedUrl);
    if (fallbackUrl) {
      try {
        const fallbackXml = await fetchFeedXml(fallbackUrl);
        const fallbackFeed = await parser.parseString(fallbackXml);
        return parseFeedItems(fallbackFeed);
      } catch {
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
}

