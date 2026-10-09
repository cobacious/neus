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
import { generateEmbedding, resolveEmbeddingModel } from '../../lib/aiClient';

const MAX_EMBEDDING_CHARS = 8192;

export async function embedNewArticles() {
  logPipelineStep(PipelineStep.Embed, 'Embedding new articles...');

  const MAX_EMBEDDINGS_PER_RUN = process.env.MAX_EMBEDDINGS
    ? parseInt(process.env.MAX_EMBEDDINGS, 10)
    : 0;

  const unembedded = await getUnembeddedArticles();
  logPipelineSection(PipelineStep.Embed, `Found ${unembedded.length} unembedded articles`);

  const articlesToEmbed =
    MAX_EMBEDDINGS_PER_RUN > 0 ? unembedded.slice(0, MAX_EMBEDDINGS_PER_RUN) : unembedded;
  if (MAX_EMBEDDINGS_PER_RUN > 0 && unembedded.length > MAX_EMBEDDINGS_PER_RUN) {
    logPipelineSection(
      PipelineStep.Embed,
      `Limiting to ${MAX_EMBEDDINGS_PER_RUN} articles (set MAX_EMBEDDINGS=0 for unlimited)`
    );
  }

  const model = resolveEmbeddingModel();
  logPipelineSection(PipelineStep.Embed, `Using ${model} for embeddings`);

  let embedded = 0;
  for (const article of articlesToEmbed) {
    const textToEmbed = article.content || article.snippet || article.title;

    if (!textToEmbed || textToEmbed.trim().length === 0) {
      logPipelineSection(
        PipelineStep.Embed,
        `Skipping (no text): ${article.title} (${article.url})`
      );
      continue;
    }

    const abridged = textToEmbed.slice(0, MAX_EMBEDDING_CHARS);

    try {
      const embedding = await generateEmbedding(abridged);

      if (process.env.GEMINI_API_KEY && process.env.NODE_ENV !== 'test') {
        await new Promise((r) => setTimeout(r, 1200));
      }

      await updateArticleEmbedding(article.id, embedding);
      embedded++;
    } catch (err: any) {
      logger.error(
        `[${PipelineStep.Embed}] Failed embedding for article ${article.id}:`,
        err.message || err
      );
    }
  }

  logPipelineSection(PipelineStep.Embed, `Successfully embedded ${embedded} articles`);
}
