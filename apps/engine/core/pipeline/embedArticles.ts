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

function getEmbeddingClient() {
  // Prefer OpenAI for embeddings since Gemini OpenAI compatibility endpoint does not support text-embedding-004
  const useOpenAI = !!process.env.OPENAI_API_KEY;
  const openai = useOpenAI
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
    : new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
  const model = useOpenAI ? 'text-embedding-3-small' : 'text-embedding-004';
  return { openai, model };
}

const MAX_EMBEDDING_CHARS = 8192;

export async function embedNewArticles() {
  logPipelineStep(PipelineStep.Embed, 'Embedding new articles...');

  const MAX_EMBEDDINGS_PER_RUN = process.env.MAX_EMBEDDINGS
    ? parseInt(process.env.MAX_EMBEDDINGS, 10)
    : 0;

  const { openai, model: EMBEDDING_MODEL } = getEmbeddingClient();

  const unembedded = await getUnembeddedArticles();

  logPipelineSection(PipelineStep.Embed, `Found ${unembedded.length} unembedded articles`);

  // Apply limit if configured
  const articlesToEmbed =
    MAX_EMBEDDINGS_PER_RUN > 0 ? unembedded.slice(0, MAX_EMBEDDINGS_PER_RUN) : unembedded;
  if (MAX_EMBEDDINGS_PER_RUN > 0 && unembedded.length > MAX_EMBEDDINGS_PER_RUN) {
    logPipelineSection(
      PipelineStep.Embed,
      `Limiting to ${MAX_EMBEDDINGS_PER_RUN} articles (set MAX_EMBEDDINGS=0 for unlimited)`
    );
  }

  let embedded = 0;
  for (const article of articlesToEmbed) {
    // Use content if available, otherwise fall back to snippet
    const textToEmbed = article.content || article.snippet || article.title;

    if (!textToEmbed || textToEmbed.trim().length === 0) {
      logPipelineSection(
        PipelineStep.Embed,
        `Skipping (no text): ${article.title} (${article.url})`
      );
      continue;
    }

    try {
      const abridged = textToEmbed.slice(0, MAX_EMBEDDING_CHARS);
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
