import { prisma } from '../client';
import { Prisma } from '@prisma/client';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

export interface MigrationArticle {
  id: string;
  title: string;
  snippet: string | null;
  content: string | null;
}

export interface MigrationCluster {
  id: string;
  headline: string | null;
  summary: string | null;
}

/**
 * Finds all articles with legacy vectors that do not match the Gemini coordinate space.
 */
export async function getArticlesNeedingMigration(
  referenceGeminiVector: number[]
): Promise<MigrationArticle[]> {
  const pageSize = 1000;
  let cursor: string | undefined;
  const candidates: MigrationArticle[] = [];

  while (true) {
    const articles = await prisma.article.findMany({
      where: {
        embedding: { not: Prisma.DbNull },
      },
      select: {
        id: true,
        title: true,
        snippet: true,
        content: true,
        embedding: true,
      },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (articles.length === 0) break;

    for (const a of articles) {
      const emb = a.embedding as number[];
      if (Array.isArray(emb) && emb.length > 0) {
        const sim = Math.abs(cosineSimilarity(referenceGeminiVector, emb));
        if (sim < 0.15) {
          candidates.push({
            id: a.id,
            title: a.title,
            snippet: a.snippet,
            content: a.content,
          });
        }
      }
    }

    cursor = articles[articles.length - 1].id;
    if (articles.length < pageSize) break;
  }

  return candidates;
}

/**
 * Finds all active clusters with legacy vectors that do not match the Gemini coordinate space.
 */
export async function getClustersNeedingMigration(
  referenceGeminiVector: number[]
): Promise<MigrationCluster[]> {
  const clusters = await prisma.cluster.findMany({
    where: {
      archived: false,
      embedding: { not: Prisma.DbNull },
    },
    select: {
      id: true,
      headline: true,
      summary: true,
      embedding: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const candidates: MigrationCluster[] = [];
  for (const c of clusters) {
    const emb = c.embedding as number[];
    if (Array.isArray(emb) && emb.length > 0) {
      const sim = Math.abs(cosineSimilarity(referenceGeminiVector, emb));
      if (sim < 0.15) {
        candidates.push({
          id: c.id,
          headline: c.headline,
          summary: c.summary,
        });
      }
    }
  }

  return candidates;
}

/**
 * Updates article embeddings in concurrent chunks.
 */
export async function updateArticleEmbeddingsBatch(
  updates: Array<{ id: string; embedding: number[] }>,
  chunkSize = 50
): Promise<void> {
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((item) =>
        prisma.article.update({
          where: { id: item.id },
          data: { embedding: item.embedding },
        })
      )
    );
  }
}

/**
 * Updates cluster embeddings in concurrent chunks.
 */
export async function updateClusterEmbeddingsBatch(
  updates: Array<{ id: string; embedding: number[] }>,
  chunkSize = 50
): Promise<void> {
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((item) =>
        prisma.cluster.update({
          where: { id: item.id },
          data: { embedding: item.embedding },
        })
      )
    );
  }
}

/**
 * Recomputes cluster centroid embeddings from their assigned articles.
 * Returns IDs of clusters that have no assigned articles with valid embeddings.
 */
export async function recomputeClusterCentroids(clusterIds: string[]): Promise<string[]> {
  const uncomputableIds: string[] = [];

  for (const clusterId of clusterIds) {
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

        await prisma.cluster.update({
          where: { id: clusterId },
          data: { embedding: centroid },
        });
      } else {
        uncomputableIds.push(clusterId);
      }
    } catch {
      uncomputableIds.push(clusterId);
    }
  }

  return uncomputableIds;
}
