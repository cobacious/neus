// printClusters.ts
// Print a human-readable report of clusters, their summaries, and their articles
import { getClustersWithArticles } from '@neus/db';

async function main() {
  const clusters = await getClustersWithArticles();

  for (const cluster of clusters) {
    if (!cluster.articleAssignments.length) continue;
    console.log('='.repeat(80));
    console.log(`Cluster ID: ${cluster.id}`);
    console.log(`Headline: ${cluster.headline || '(none)'}`);
    console.log(`Summary: ${cluster.summary || '(none)'}`);
    console.log('Articles:');
    for (const assignment of cluster.articleAssignments) {
      const a = assignment.article;
      console.log(`- ${a.title}`);
      console.log(`- Snippet: ${a.snippet}`);
      console.log(`- URL: ${a.url}`);
      if (assignment !== cluster.articleAssignments[cluster.articleAssignments.length - 1]) {
        console.log('-'.repeat(80));
      }
    }
  }
}

main().catch((err) => {
  console.error('[printClusters] Error:', err);
  process.exit(1);
});
