// Main processing pipeline for ingested articles
// This is where clustering, summarization, and storage will be handled
import './env'; // Loads .env and proxy support
import { Article } from '../../packages/types/article';
import { clusterArticlesLLM, StoryCluster } from './cluster';

export async function processAndStoreArticles(articles: Article[]) {
  // Cluster articles into stories using LLM (placeholder for now)
  const clusters: StoryCluster[] = await clusterArticlesLLM(articles);
  console.log(`[pipeline] Clustered into ${clusters.length} stories.`);
  // TODO: Generate neutral summaries for each story
  // TODO: Extract and normalize metadata
  // TODO: Store results in persistent storage (file/db)

  // For now, just log the clusters (placeholder)
  clusters.forEach((cluster, i) => {
    console.log(`Story #${i + 1} (${cluster.articles.length} articles):`);
    cluster.articles.forEach(a => console.log(`  - ${a.title}`));
  });
}
