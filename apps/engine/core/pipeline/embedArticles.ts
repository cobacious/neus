import OpenAI from 'openai';
import {
  getUnembeddedArticles,
  updateArticleEmbedding,
} from '@neus/db';
import {
  logger,
  logPipelineSection,
  logPipelineStep,
  PipelineStep,
} from '../../lib/pipelineLogger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_EMBEDDING_CHARS = 8192;
const MAX_EMBEDDINGS_PER_RUN = 100; // Safety limit to prevent runaway costs

export async function embedNewArticles() {
  logPipelineStep(PipelineStep.Embed, 'Embedding new articles...');

  const unembedded = await getUnembeddedArticles();

  logPipelineSection(PipelineStep.Embed, `Found ${unembedded.length} unembedded articles`);

  // Apply safety limit
  const articlesToEmbed = unembedded.slice(0, MAX_EMBEDDINGS_PER_RUN);
  if (unembedded.length > MAX_EMBEDDINGS_PER_RUN) {
    logPipelineSection(
      PipelineStep.Embed,
      `Limiting to ${MAX_EMBEDDINGS_PER_RUN} articles to prevent excessive API costs`
    );
  }

  let embedded = 0;
  for (const article of articlesToEmbed) {
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
      await updateArticleEmbedding(article.id, embedding);
      embedded++;
    } catch (err) {
      logger.error(
        `[${PipelineStep.Embed}] Failed embedding: ${article.title} (${article.url})`,
        err
      );
    }
  }

  logPipelineSection(PipelineStep.Embed, `Successfully embedded ${embedded} articles`);
}
