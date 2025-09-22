import OpenAI from 'openai';
import { getUnembeddedArticles, updateArticleEmbedding } from '@neus/db';
import {
  logger,
  logPipelineSection,
  logPipelineStep,
  PipelineStep,
} from '../../lib/pipelineLogger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_EMBEDDING_CHARS = 8192;

export async function embedNewArticles() {
  logPipelineStep(PipelineStep.Embed, 'Embedding new articles...');

  const unembeddedArticles = await getUnembeddedArticles();

  logPipelineSection(PipelineStep.Embed, `Found ${unembeddedArticles.length} unembedded articles`);

  unembeddedArticles.forEach(async (article) => {
    if (!article.content) {
      logPipelineSection(
        PipelineStep.Embed,
        `Skipping (no content): ${article.title} (${article.url})`
      );
      return;
    }
    try {
      const abridged = article.content.slice(0, MAX_EMBEDDING_CHARS);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: abridged,
      });
      const embedding = response.data[0].embedding as number[];
      await updateArticleEmbedding(article.id, embedding);
    } catch (err) {
      logger.error(
        `[${PipelineStep.Embed}] Failed embedding: ${article.title} (${article.url})`,
        err
      );
    }
  });
}
