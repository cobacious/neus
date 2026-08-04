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

const MAX_EMBEDDING_CHARS = 8192;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || 'mock-key',
});

async function getGeminiEmbedding(apiKey: string, text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text }],
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini embedding API error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as { embedding?: { values?: number[] } };
  if (!data.embedding?.values) {
    throw new Error('Gemini embedding response missing values');
  }
  return data.embedding.values;
}

function getEmbeddingProvider() {
  const useGemini = !!process.env.GEMINI_API_KEY;

  if (useGemini) {
    const apiKey = process.env.GEMINI_API_KEY!;
    return {
      provider: 'gemini (text-embedding-004)',
      embed: (text: string) => getGeminiEmbedding(apiKey, text),
    };
  }

  return {
    provider: 'openai (text-embedding-3-small)',
    embed: async (text: string) => {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding as number[];
    },
  };
}

export async function embedNewArticles() {
  logPipelineStep(PipelineStep.Embed, 'Embedding new articles...');

  const MAX_EMBEDDINGS_PER_RUN = process.env.MAX_EMBEDDINGS
    ? parseInt(process.env.MAX_EMBEDDINGS, 10)
    : 0;

  const { provider, embed } = getEmbeddingProvider();
  logPipelineSection(PipelineStep.Embed, `Using ${provider} for embeddings`);

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
      const embedding = await embed(abridged);
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
