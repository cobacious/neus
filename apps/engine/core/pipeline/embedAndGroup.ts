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
  logPipelineStep(PipelineStep.Embed, 'Clustering articles...');

  const unembedded = await prisma.article.findMany({
    where: { embedding: { equals: Prisma.DbNull } },
  });

  logPipelineSection(PipelineStep.Embed, `Found ${unembedded.length} unembedded articles`);

  for (const article of unembedded) {
    // Only embed if content is present
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
      logger.error(`[${PipelineStep.Embed}] Failed: ${article.title} (${article.url})`, err);
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

  const clusters: { [clusterId: string]: string[] } = {};
  for (const article of recent) {
    if (!Array.isArray(article.embedding)) continue;
    const aVec = article.embedding as number[];
    let bestMatch: typeof article | null = null;
    let bestScore = 0;

    for (const other of recent) {
      if (article.url === other.url) continue;
      if (!Array.isArray(other.embedding)) continue;
      const bVec = other.embedding as number[];
      const score = cosineSimilarity(aVec, bVec);
      if (score > SIMILARITY_THRESHOLD && score > bestScore) {
        bestMatch = other;
        bestScore = score;
      }
    }

    if (bestMatch) {
      const existing = await prisma.articleClusterAssignment.findMany({
        where: {
          OR: [{ articleId: article.id }, { articleId: bestMatch.id }],
        },
      });

      let clusterId: string;
      if (existing.length > 0) {
        clusterId = existing[0].clusterId;
      } else {
        const cluster = await prisma.cluster.create({
          data: {
            origin: 'embedding',
            label: null,
          },
        });
        clusterId = cluster.id;
      }

      // Check if these assignments already exist to avoid unique constraint errors
      const assignmentsToCreate: any[] = [];
      const existingAssignments = await prisma.articleClusterAssignment.findMany({
        where: {
          OR: [
            { articleId: article.id, clusterId },
            { articleId: bestMatch.id, clusterId },
          ],
        },
      });
      const alreadyAssigned = new Set(existingAssignments.map((a) => a.articleId));
      if (!alreadyAssigned.has(article.id)) {
        assignmentsToCreate.push({
          articleId: article.id,
          clusterId,
          similarity: bestScore,
          method: 'embedding',
        });
      }
      if (!alreadyAssigned.has(bestMatch.id)) {
        assignmentsToCreate.push({
          articleId: bestMatch.id,
          clusterId,
          similarity: bestScore,
          method: 'embedding',
        });
      }
      if (assignmentsToCreate.length > 0) {
        await prisma.articleClusterAssignment.createMany({
          data: assignmentsToCreate,
        });
      }

      // Use url for reporting and deduplication
      clusters[clusterId] = Array.from(
        new Set([...(clusters[clusterId] || []), article.url, bestMatch.url])
      );
    }
  }

  logPipelineSection(
    PipelineStep.Embed,
    `Created/updated ${Object.keys(clusters).length} clusters`
  );
  logPipelineSection(
    PipelineStep.Embed,
    `[pipeline] Clustering complete. ${Object.keys(clusters).length} clusters created/updated.`
  );
}
