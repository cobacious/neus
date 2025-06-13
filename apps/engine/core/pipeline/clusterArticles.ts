import {
  getRecentEmbeddedArticles,
  createCluster,
  createArticleAssignments,
} from '@neus/db';
import { cosineSimilarity } from './utils';
import {
  logger,
  logPipelineSection,
  logPipelineStep,
  PipelineStep,
} from '../../lib/pipelineLogger';

const SIMILARITY_THRESHOLD = 0.85;
const MAX_LOOKBACK_HOURS = 48;

export async function clusterRecentArticles() {
  logPipelineStep(PipelineStep.Cluster, 'Clustering recent articles...');

  const recent = await getRecentEmbeddedArticles(
    new Date(Date.now() - MAX_LOOKBACK_HOURS * 60 * 60 * 1000)
  );

  // Build articleMap for quick lookup
  const articleMap = new Map(recent.map((a) => [a.id, a]));

  // Build edges
  const edges = recent.flatMap((a, i) =>
    !Array.isArray(a.embedding)
      ? []
      : (recent
          .slice(i + 1)
          .filter((b) => Array.isArray(b.embedding))
          .map((b) => {
            const sim = cosineSimilarity(a.embedding as number[], b.embedding as number[]);
            return sim > SIMILARITY_THRESHOLD
              ? ([a.id as string, b.id as string, sim] as [string, string, number])
              : null;
          })
          .filter(Boolean) as [string, string, number][])
  );

  // Cluster discovery (DFS)
  const visited = new Set<string>();
  const clusters: string[][] = [];
  recent.forEach((article) => {
    if (visited.has(article.id)) return;
    const cluster: string[] = [];
    const stack: string[] = [article.id];
    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);
      edges
        .filter((e) => e[0] === current || e[1] === current)
        .map((e) => (e[0] === current ? e[1] : e[0]))
        .forEach((neighbor) => {
          if (!visited.has(neighbor)) stack.push(neighbor);
        });
    }
    if (cluster.length > 0) clusters.push(cluster);
  });
  // Add singletons
  recent.forEach((article) => {
    if (!visited.has(article.id)) clusters.push([article.id]);
  });

  let createdClusters = 0;
  for (const group of clusters) {
    const cluster = await createCluster('embedding', null);
    // Use map/filter/reduce for assignments
    const assignments = group
      .map((id) => {
        const article = articleMap.get(id);
        if (!article || !Array.isArray(article.embedding)) return null;
        const similarity =
          group
            .filter((otherId) => otherId !== id)
            .map((otherId) => {
              const other = articleMap.get(otherId);
              return other && Array.isArray(other.embedding)
                ? cosineSimilarity(article.embedding as number[], other.embedding as number[])
                : 0;
            })
            .reduce((a, b) => a + b, 0) / Math.max(1, group.length - 1);
        return {
          articleId: id,
          clusterId: cluster.id,
          similarity,
          method: 'embedding',
        };
      })
      .filter(Boolean) as {
      articleId: string;
      clusterId: string;
      similarity: number;
      method: string;
    }[];
    await createArticleAssignments(assignments);
    createdClusters++;
  }
  logPipelineSection(
    PipelineStep.Cluster,
    `Clustering complete. ${createdClusters} clusters created.`
  );
}
