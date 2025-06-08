// Simple utility for clustering articles by similarity
// For now, cluster by normalized title similarity (case-insensitive, basic deduplication)
// TODO: Replace with LLM or embedding-based clustering for better accuracy

import { Article } from '../../packages/types/article';
import { fetch } from './fetcher';

// --- LLM integration for clustering ---
// This example uses OpenAI's GPT-3.5/4 API, but you can swap in Claude or another provider.
// Assumes you have an OPENAI_API_KEY in your environment.

declare const process: any;

export interface StoryCluster {
  id: string;
  articles: Article[];
  // Add more fields as needed (e.g., summary, canonical headline)
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

export function clusterArticles(articles: Article[]): StoryCluster[] {
  const clusters: Record<string, StoryCluster> = {};
  for (const article of articles) {
    const norm = normalizeTitle(article.title);
    if (!clusters[norm]) {
      clusters[norm] = {
        id: norm,
        articles: [],
      };
    }
    clusters[norm].articles.push(article);
  }
  return Object.values(clusters);
}

// Use native fetch for OpenAI API calls to ensure proxying works with global-agent
async function callOpenAI(messages: any[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature: 0.2,
    }),
  });
  const data = await response.json();
  // @ts-ignore
  return data.choices[0].message.content;
}

export async function clusterArticlesLLM(articles: Article[]): Promise<StoryCluster[]> {
  // Prepare prompt for LLM
  const system = {
    role: 'system',
    content:
      'You are a news clustering engine. Group related news articles into clusters (stories) based on topic, even if headlines differ. Be strict: only group articles if they are clearly about the same event or development. Use all available context (title, content, source, date). Return JSON: [{"cluster": <string>, "articles": [<index>, ...]}] where <index> is the index of the article in the input array.',
  };
  const user = {
    role: 'user',
    content: JSON.stringify(
      articles.map((a) => ({
        title: a.title,
        content: a.content,
        source: a.source,
        publishedAt: a.publishedAt,
      }))
    ),
  };
  let llmResponse;
  try {
    llmResponse = await callOpenAI([system, user]);
    // Remove Markdown code block markers if present
    const cleaned = llmResponse.replace(/^```json\s*|```$/g, '').trim();
    // Try to parse the LLM's response as JSON
    const clustersRaw = JSON.parse(cleaned);
    // Map LLM clusters to StoryCluster objects
    return clustersRaw.map((c: any, i: number) => ({
      id: c.cluster || `llm-cluster-${i}`,
      articles: c.articles.map((idx: number) => articles[idx]),
    }));
  } catch (err) {
    console.error(
      '[LLM clustering] Error or invalid response, falling back to simple clustering:',
      err,
      '\nRaw LLM response:',
      llmResponse
    );
    return clusterArticles(articles);
  }
}
