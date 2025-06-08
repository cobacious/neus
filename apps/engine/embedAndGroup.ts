import OpenAI from 'openai';
import { prisma } from './lib/prisma';
import { cosineSimilarity } from './utils';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = 'text-embedding-3-small';
const SIMILARITY_THRESHOLD = 0.85;
const MAX_LOOKBACK_HOURS = 48;
const MAX_EMBEDDING_CHARS = 8192;

export async function embedAndClusterNewArticles() {
  const unembedded = await prisma.article.findMany({
    where: { embedding: { equals: undefined } }, // Use undefined for JSON null in Prisma
  });

  console.log(`Found ${unembedded.length} unembedded articles`);

  for (const article of unembedded) {
    // Only embed if content is present
    if (!article.content) continue;
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
  }

  const recent = await prisma.article.findMany({
    where: {
      // Use JsonNullValueFilter for JSON null filter
      embedding: { not: { equals: null } },
      publishedAt: {
        gte: new Date(Date.now() - MAX_LOOKBACK_HOURS * 60 * 60 * 1000),
      },
    },
  });

  const clusters: { [clusterId: string]: string[] } = {};
  for (const article of recent) {
    // Validate embedding type
    if (!Array.isArray(article.embedding)) continue;
    const aVec = article.embedding as number[];
    let bestMatch: typeof article | null = null;
    let bestScore = 0;

    for (const other of recent) {
      if (article.id === other.id) continue;
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

      await prisma.articleClusterAssignment.createMany({
        data: [
          {
            articleId: article.id,
            clusterId,
            similarity: bestScore,
            method: 'embedding',
          },
          {
            articleId: bestMatch.id,
            clusterId,
            similarity: bestScore,
            method: 'embedding',
          },
        ],
      } as any);

      clusters[clusterId] = [...(clusters[clusterId] || []), article.id, bestMatch.id];
    }
  }

  console.log(`Created/updated ${Object.keys(clusters).length} clusters`);
}
