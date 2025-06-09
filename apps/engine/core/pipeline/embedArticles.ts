import OpenAI from 'openai';
import { prisma } from '../../lib/prisma';
import {
  logger,
  logPipelineSection,
  logPipelineStep,
  PipelineStep,
} from '../../lib/pipelineLogger';
import { Prisma } from '@prisma/client';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_EMBEDDING_CHARS = 8192;

export async function embedNewArticles() {
  logPipelineStep(PipelineStep.Embed, 'Embedding new articles...');

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
      const abridged = article.content.slice(0, MAX_EMBEDDING_CHARS);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: abridged,
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
}
