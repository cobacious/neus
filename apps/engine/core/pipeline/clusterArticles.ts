import { getRecentEmbeddedArticles, createCluster, createArticleAssignments } from '@neus/db';
import { cosineSimilarity, jaccard } from './utils';
import {
  logger,
  logPipelineSection,
  logPipelineStep,
  PipelineStep,
} from '../../lib/pipelineLogger';

const SIMILARITY_THRESHOLD = 0.85;
const MAX_LOOKBACK_HOURS = 48;
const ALLOW_SINGLE_ARTICLE_CLUSTERS = false; // Set to false to skip single article clusters

export async function clusterRecentArticles() {
  logPipelineStep(PipelineStep.Cluster, 'Clustering recent articles...');

  const recent = await getRecentEmbeddedArticles(
    new Date(Date.now() - MAX_LOOKBACK_HOURS * 60 * 60 * 1000)
  );

  const articleMap = new Map(recent.map((a) => [a.id, a]));

  const edges = recent.flatMap((a, i) =>
    !Array.isArray(a.embedding)
      ? []
      : (recent
          .slice(i + 1)
          .filter((b) => Array.isArray(b.embedding))
          .map((b) => {
            const similarity = cosineSimilarity(a.embedding as number[], b.embedding as number[]);
            return similarity > SIMILARITY_THRESHOLD
              ? ([a.id as string, b.id as string, similarity] as [string, string, number])
              : null;
          })
          .filter(Boolean) as [string, string, number][])
  );

  const clustered = new Set<string>(); // Tracks all articles connected in a DFS cluster
  const clusters: string[][] = [];
  recent.forEach((article) => {
    if (clustered.has(article.id)) return;
    const cluster: string[] = [];
    const stack: string[] = [article.id];
    while (stack.length) {
      const current = stack.pop()!;
      if (clustered.has(current)) continue;
      clustered.add(current);
      cluster.push(current);
      edges
        .filter((e) => e[0] === current || e[1] === current)
        .map((e) => (e[0] === current ? e[1] : e[0]))
        .forEach((neighbor) => {
          if (!clustered.has(neighbor)) stack.push(neighbor);
        });
    }
    if (cluster.length > 0) clusters.push(cluster);
  });

  const assignedArticles = new Set<string>();
  const filteredClusters: string[][] = [];
  let skippedDuplicates = 0;
  let skippedEmpty = 0;

  for (const cluster of clusters) {
    const unique = cluster.filter((id) => !assignedArticles.has(id));
    if (unique.length > 0) {
      const isDuplicate = filteredClusters.some((existing) => jaccard(existing, unique) > 0.8);
      if (!isDuplicate) {
        unique.forEach((id) => assignedArticles.add(id));
        filteredClusters.push(unique);
      } else {
        skippedDuplicates++;
        logger.warn(
          `[${PipelineStep.Cluster}]: Skipping near-duplicate cluster with articles: [${unique.join(', ')}]`
        );
      }
    } else {
      skippedEmpty++;
    }
  }

  if (ALLOW_SINGLE_ARTICLE_CLUSTERS) {
    recent.forEach((article) => {
      if (!clustered.has(article.id) && !assignedArticles.has(article.id)) {
        assignedArticles.add(article.id);
        filteredClusters.push([article.id]);
      }
    });
  }

  let createdClusters = 0;
  for (const group of filteredClusters) {
    const cluster = await createCluster('embedding', null);
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
    `Clustering complete. ${createdClusters} clusters created. ${skippedDuplicates} duplicates skipped, ${skippedEmpty} empty filtered.`
  );
}
