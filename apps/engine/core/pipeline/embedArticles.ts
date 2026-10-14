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
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  resolveEmbeddingModel,
} from '../../lib/aiClient';

const MAX_EMBEDDING_CHARS = 8192;
const BATCH_SIZE = 50;

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

  const validArticles: Array<{ id: string; text: string; title: string }> = [];
  for (const article of articlesToEmbed) {
    const textToEmbed = article.content || article.snippet || article.title;

    if (!textToEmbed || textToEmbed.trim().length === 0) {
      logPipelineSection(
        PipelineStep.Embed,
        `Skipping (no text): ${article.title} (${article.url})`
      );
      continue;
    }

    validArticles.push({
      id: article.id,
      text: textToEmbed.slice(0, MAX_EMBEDDING_CHARS),
      title: article.title,
    });
  }

  let embedded = 0;
  for (let i = 0; i < validArticles.length; i += BATCH_SIZE) {
    const batch = validArticles.slice(i, i + BATCH_SIZE);
    try {
      let vectors: number[][];
      if (typeof generateEmbeddingsBatch === 'function') {
        vectors = await generateEmbeddingsBatch(batch.map((b) => b.text));
      } else {
        vectors = await Promise.all(batch.map((b) => generateEmbedding(b.text)));
      }

      for (let j = 0; j < batch.length; j++) {
        const vector = vectors[j];
        if (vector && Array.isArray(vector)) {
          await updateArticleEmbedding(batch[j].id, vector);
          embedded++;
        }
      }
    } catch (err: any) {
      logger.error(
        `[${PipelineStep.Embed}] Batch embedding failed for ${batch.length} articles, falling back to individual:`,
        err.message || err
      );
      for (const item of batch) {
        try {
          const vector = await generateEmbedding(item.text);
          await updateArticleEmbedding(item.id, vector);
          embedded++;
        } catch (singleErr: any) {
          logger.error(
            `[${PipelineStep.Embed}] Failed embedding for article ${item.id}:`,
            singleErr.message || singleErr
          );
        }
      }
    }
  }

  logPipelineSection(PipelineStep.Embed, `Successfully embedded ${embedded} articles`);
}
