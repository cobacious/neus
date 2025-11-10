import {
  getUnclusteredArticles,
  getRecentClustersWithEmbeddings,
  createCluster,
  createArticleAssignments,
  updateClusterEmbedding,
} from '@neus/db';
import type { ClusterAssignment } from '@neus/db';
import { cosineSimilarity, jaccard } from './utils';
import {
  logger,
  logPipelineSection,
  logPipelineStep,
  PipelineStep,
} from '../../lib/pipelineLogger';

const SIMILARITY_THRESHOLD = 0.85;
const ALLOW_SINGLE_ARTICLE_CLUSTERS = false; // Set to false to skip single article clusters

export async function clusterRecentArticles() {
  logPipelineStep(PipelineStep.Cluster, 'Clustering recent articles...');

  const articles = await getUnclusteredArticles();
  const existingClusters = await getRecentClustersWithEmbeddings();

  logPipelineSection(
    PipelineStep.Cluster,
    `Found ${articles.length} unclustered articles and ${existingClusters.length} recent clusters`
  );

  // Step 1: Try to assign articles to existing clusters first (prevents duplicates)
  const assignedToExisting: string[] = [];
  const assignmentsToExisting: ClusterAssignment[] = [];

  for (const article of articles) {
    if (!Array.isArray(article.embedding)) continue;

    // Find best matching existing cluster
    let bestMatch: { clusterId: string; similarity: number } | null = null;

    for (const cluster of existingClusters) {
      if (!Array.isArray(cluster.embedding)) continue;

      const similarity = cosineSimilarity(
        article.embedding as number[],
        cluster.embedding as number[]
      );

      if (similarity > SIMILARITY_THRESHOLD && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { clusterId: cluster.id, similarity };
      }
    }

    if (bestMatch) {
      assignmentsToExisting.push({
        articleId: article.id,
        clusterId: bestMatch.clusterId,
        similarity: bestMatch.similarity,
        method: 'embedding',
      });
      assignedToExisting.push(article.id);
    }
  }

  // Create assignments to existing clusters
  if (assignmentsToExisting.length > 0) {
    await createArticleAssignments(assignmentsToExisting);
    logPipelineSection(
      PipelineStep.Cluster,
      `Assigned ${assignmentsToExisting.length} articles to ${new Set(assignmentsToExisting.map((a) => a.clusterId)).size} existing clusters`
    );
  }

  // Step 2: Cluster remaining articles among themselves
  const remainingArticles = articles.filter((a) => !assignedToExisting.includes(a.id));

  if (remainingArticles.length === 0) {
    logPipelineSection(PipelineStep.Cluster, 'No remaining articles to cluster. Done.');
    return;
  }

  logPipelineSection(
    PipelineStep.Cluster,
    `Clustering ${remainingArticles.length} remaining articles`
  );

  const articleMap = new Map(remainingArticles.map((a) => [a.id, a]));

  const edges = remainingArticles.flatMap((a, i) =>
    !Array.isArray(a.embedding)
      ? []
      : (remainingArticles
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
  remainingArticles.forEach((article) => {
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
    remainingArticles.forEach((article) => {
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
    const embeddings = group
      .map((id) => articleMap.get(id))
      .filter((a): a is { embedding: number[] } => Boolean(a && Array.isArray(a.embedding)))
      .map((a) => a.embedding as number[]);
    if (embeddings.length) {
      const dims = embeddings[0].length;
      const mean = Array(dims).fill(0);
      embeddings.forEach((e) =>
        e.forEach((v, i) => {
          mean[i] += v;
        })
      );
      for (let i = 0; i < dims; i++) {
        mean[i] /= embeddings.length;
      }
      await updateClusterEmbedding(cluster.id, mean);
    }
    createdClusters++;
  }
  logPipelineSection(
    PipelineStep.Cluster,
    `Clustering complete. ${createdClusters} clusters created. ${skippedDuplicates} duplicates skipped, ${skippedEmpty} empty filtered.`
  );
}
