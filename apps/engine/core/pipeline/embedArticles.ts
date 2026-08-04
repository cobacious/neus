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
  const modelName = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${modelName}`,
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

async function getOpenAIEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding as number[];
}

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

  const geminiKey = process.env.GEMINI_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY || process.env.NODE_ENV === 'test';

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
    let embedding: number[] | null = null;

    // Try Gemini first if key is present
    if (geminiKey) {
      try {
        embedding = await getGeminiEmbedding(geminiKey, abridged);
      } catch (geminiErr: any) {
        logger.warn(
          `[${PipelineStep.Embed}] Gemini embedding failed for article ${article.id}, trying OpenAI fallback... Error: ${geminiErr.message || geminiErr}`
        );
      }
    }

    // Fallback to OpenAI if Gemini failed or key not present
    if (!embedding && hasOpenAIKey) {
      try {
        embedding = await getOpenAIEmbedding(abridged);
      } catch (openaiErr: any) {
        logger.error(
          `[${PipelineStep.Embed}] OpenAI embedding fallback failed for article ${article.id}:`,
          openaiErr
        );
      }
    }

    if (embedding) {
      await updateArticleEmbedding(article.id, embedding);
      embedded++;
    } else {
      logger.error(`[${PipelineStep.Embed}] Failed embedding for article ${article.id}`);
    }
  }

  logPipelineSection(PipelineStep.Embed, `Successfully embedded ${embedded} articles`);
}
