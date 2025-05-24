// Article ingestion service for Neus backend engine
// Fetches articles from RSS feeds (initial version)
// TODO: Add scraping and more robust error handling

import Parser from 'rss-parser';
import { Article } from '../../packages/types/article';

const parser = new Parser();

export async function fetchArticlesFromRss(feedUrl: string): Promise<Article[]> {
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
}

// Example usage (for dev/testing):
// (async () => {
//   const articles = await fetchArticlesFromRss('https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml');
//   console.log(articles);
// })();
