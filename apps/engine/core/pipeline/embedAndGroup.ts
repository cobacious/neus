import OpenAI from 'openai';
import { prisma } from '../../lib/prisma';
import { cosineSimilarity } from './utils';
import {
  logger,
  logPipelineSection,
  logPipelineStep,
  PipelineStep,
} from '../../lib/pipelineLogger';
import { Prisma } from '@prisma/client';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = 'text-embedding-3-small';
const SIMILARITY_THRESHOLD = 0.85;
const MAX_LOOKBACK_HOURS = 48;
const MAX_EMBEDDING_CHARS = 8192;

export async function embedAndClusterNewArticles() {
  logPipelineStep(PipelineStep.Embed, 'Embedding and clustering articles...');

  const unembedded = await prisma.article.findMany({
    where: { embedding: { equals: Prisma.DbNull } },
  });

  logPipelineSection(PipelineStep.Embed, `Found ${unembedded.length} unembedded articles`);

  for (const article of unembedded) {
    if (!article.content) {
      logPipelineSection(
        PipelineStep.Embed,
        `Skipping (no content): ${article.title} (${article.url})`
      );
      continue;
    }
    try {
      const cleaned = article.content.slice(0, MAX_EMBEDDING_CHARS);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: cleaned,
      });
      const embedding = response.data[0].embedding as number[];
      await prisma.article.update({
        where: { id: article.id },
        data: { embedding },
      });
    } catch (err) {
      logger.error(
        `[${PipelineStep.Embed}] Failed embedding: ${article.title} (${article.url})`,
        err
      );
    }
  }

  const recent = await prisma.article.findMany({
    where: {
      embedding: { not: { equals: null } },
      publishedAt: {
        gte: new Date(Date.now() - MAX_LOOKBACK_HOURS * 60 * 60 * 1000),
      },
    },
  });

  const edges: [string, string, number][] = [];
  const articleMap = new Map<string, (typeof recent)[0]>();
  for (const a of recent) articleMap.set(a.id, a);

  for (let i = 0; i < recent.length; i++) {
    const a = recent[i];
    if (!Array.isArray(a.embedding)) continue;
    for (let j = i + 1; j < recent.length; j++) {
      const b = recent[j];
      if (!Array.isArray(b.embedding)) continue;
      const sim = cosineSimilarity(a.embedding as number[], b.embedding as number[]);
      if (sim > SIMILARITY_THRESHOLD) {
        edges.push([a.id as string, b.id as string, sim]);
      }
    }
  }

  const visited = new Set<string>();
  // Fix: Explicitly type cluster and assignments arrays to avoid TS 'never' errors
  const clusters: string[][] = [];

  for (const article of recent) {
    if (visited.has(article.id)) continue;

    const cluster: string[] = [];
    const stack: string[] = [article.id];
    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);
      const neighbors = edges
        .filter((e) => e[0] === current || e[1] === current)
        .map((e) => (e[0] === current ? e[1] : e[0]));
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }

    if (cluster.length > 0) clusters.push(cluster);
  }

  // Create a singleton for unclustered articles
  for (const article of recent) {
    if (!visited.has(article.id)) clusters.push([article.id]);
  }

  let createdClusters = 0;
  for (const group of clusters) {
    const cluster = await prisma.cluster.create({
      data: { origin: 'embedding', label: null },
    });

    const assignments: {
      articleId: string;
      clusterId: string;
      similarity: number;
      method: string;
    }[] = [];
    for (const id of group) {
      const article = articleMap.get(id);
      if (!article || !Array.isArray(article.embedding)) continue;
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
      assignments.push({
        articleId: id,
        clusterId: cluster.id,
        similarity,
        method: 'embedding',
      });
    }

    await prisma.articleClusterAssignment.createMany({ data: assignments });
    createdClusters++;
  }

  logPipelineSection(
    PipelineStep.Embed,
    `Clustering complete. ${createdClusters} clusters created.`
  );
}
