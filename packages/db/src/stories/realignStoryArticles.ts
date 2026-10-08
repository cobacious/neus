import { prisma } from '../client';
import { updateClusterEmbedding } from '../clusters/updateClusterEmbedding';

export interface ArticleReassignment {
  articleId: string;
  targetClusterId: string;
}

export async function getStoryArticlesForRealignment(clusterIds: string[]) {
  if (clusterIds.length === 0) return [];
  const assignments = await prisma.articleClusterAssignment.findMany({
    where: { clusterId: { in: clusterIds } },
    select: {
      articleId: true,
      clusterId: true,
      article: {
        select: {
          id: true,
          title: true,
          embedding: true,
        },
      },
    },
  });

  return assignments.map((a) => ({
    articleId: a.articleId,
    currentClusterId: a.clusterId,
    title: a.article.title,
    embedding: a.article.embedding,
  }));
}

export async function realignStoryArticles(reassignments: ArticleReassignment[]) {
  if (reassignments.length === 0) return { updatedCount: 0, affectedClusters: [] };

  const changedClusterIds = new Set<string>();
  let updatedCount = 0;

  for (const r of reassignments) {
    try {
      const current = await prisma.articleClusterAssignment.findUnique({
        where: { articleId: r.articleId },
        select: { clusterId: true },
      });

      if (current && current.clusterId !== r.targetClusterId) {
        await prisma.articleClusterAssignment.update({
          where: { articleId: r.articleId },
          data: { clusterId: r.targetClusterId },
        });
        changedClusterIds.add(current.clusterId);
        changedClusterIds.add(r.targetClusterId);
        updatedCount++;
      }
    } catch {
      // Ignore if assignment changed or deleted concurrently
    }
  }

  // Recalculate cluster centroid embeddings for affected clusters
  for (const clusterId of changedClusterIds) {
    try {
      const clusterArticles = await prisma.articleClusterAssignment.findMany({
        where: { clusterId },
        select: { article: { select: { embedding: true } } },
      });
      const validEmbeddings = clusterArticles
        .map((ca) => ca.article.embedding)
        .filter((emb): emb is number[] => Array.isArray(emb) && emb.length > 0);

      if (validEmbeddings.length > 0) {
        const dim = validEmbeddings[0].length;
        const centroid = new Array(dim).fill(0);
        for (const emb of validEmbeddings) {
          for (let d = 0; d < dim; d++) centroid[d] += emb[d];
        }
        for (let d = 0; d < dim; d++) centroid[d] /= validEmbeddings.length;
        await updateClusterEmbedding(clusterId, centroid);
      }
    } catch {
      // Best-effort centroid update
    }
  }

  return { updatedCount, affectedClusters: Array.from(changedClusterIds) };
}
