import OpenAI from 'openai';
import { logger, PipelineStep } from './pipelineLogger';

const GEMINI_API_BASE_URL =
  process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const openai =
  OPENAI_API_KEY || process.env.NODE_ENV === 'test'
    ? new OpenAI({
        apiKey: OPENAI_API_KEY || 'mock-key',
        baseURL: process.env.OPENAI_BASE_URL,
      })
    : null;

export function resolveSummaryModel(): string {
  const envModel = process.env.SUMMARY_MODEL;
  if (!envModel || envModel.includes('1.5') || envModel.includes('2.0') || envModel === 'gpt-4o-mini') {
    return process.env.GEMINI_API_KEY ? 'gemini-flash-latest' : 'gpt-4o-mini';
  }
  return envModel;
}

export function resolveEmbeddingModel(): string {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
  }
  return process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
}

export function cleanJsonResponse<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    // Attempt fallback extraction if extra text wraps the JSON payload
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to throw original error
      }
    }
    throw initialErr;
  }
}

export interface StructuredJsonRequest {
  prompt: string;
  systemInstruction?: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  step?: PipelineStep;
}

/**
 * Generates structured JSON using either Gemini or OpenAI, depending on configured environment keys.
 * Encapsulates provider endpoints, response format translation, retry backoff, and error logging.
 */
export async function generateStructuredJson<T>(
  request: StructuredJsonRequest,
  maxRetries = 3
): Promise<T> {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    const model = request.model || resolveSummaryModel();
    const url = `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${geminiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: request.temperature ?? 0.1,
        maxOutputTokens: request.maxTokens ?? 16384,
      },
    };

    if (request.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: request.systemInstruction }],
      };
    }

    if (request.schema) {
      (body.generationConfig as any).responseSchema = request.schema;
    }

    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(45000),
        });

        if (res.status === 429) {
          const backoffMs = Math.pow(2, attempt) * 2000;
          logger.warn(
            `[${request.step || PipelineStep.Cluster}] Gemini rate limit (429) on attempt ${attempt}/${maxRetries}. Backing off for ${backoffMs / 1000}s...`
          );
          if (process.env.NODE_ENV !== 'test') {
            await new Promise((r) => setTimeout(r, backoffMs));
          }
          continue;
        }

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Gemini API error (${res.status}): ${errorText}`);
        }

        const data = (await res.json()) as any;
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) throw new Error('Gemini response missing text');

        try {
          return cleanJsonResponse<T>(content);
        } catch (parseErr: any) {
          logger.error(
            `[${request.step || PipelineStep.Cluster}] JSON parse failed on text (length ${content.length}, finishReason: ${data.candidates?.[0]?.finishReason}): ${content.slice(0, 400)}`
          );
          throw parseErr;
        }
      }
    } catch (geminiError: any) {
      if (openai) {
        logger.warn(
          `[${request.step || PipelineStep.Cluster}] Gemini structured JSON failed (${geminiError.message || geminiError}), falling back to OpenAI...`
        );
      } else {
        throw geminiError;
      }
    }
  }

  if (openai) {
    const model =
      request.model && !request.model.startsWith('gemini')
        ? request.model
        : process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (request.systemInstruction) {
      messages.push({ role: 'system', content: request.systemInstruction });
    }
    messages.push({ role: 'user', content: request.prompt });

    const completion = await openai.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.1,
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('OpenAI returned empty response');
    return cleanJsonResponse<T>(content);
  }

  throw new Error('No Gemini or OpenAI API key configured for structured JSON generation');
}

/**
 * Generates an embedding vector using Gemini or OpenAI, depending on configured environment keys.
 */
export async function generateEmbedding(
  text: string,
  maxRetries = 3
): Promise<number[]> {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    const model = resolveEmbeddingModel();
    const url = `${GEMINI_API_BASE_URL}/models/${model}:embedContent?key=${geminiKey}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
      });

      if (res.status === 429) {
        const backoffMs = Math.pow(2, attempt) * 2000;
        logger.warn(
          `[${PipelineStep.Embed}] Gemini rate limit (429) on embedding attempt ${attempt}/${maxRetries}. Backing off for ${backoffMs / 1000}s...`
        );
        if (process.env.NODE_ENV !== 'test') {
          await new Promise((r) => setTimeout(r, backoffMs));
        }
        continue;
      }

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

    throw new Error(`Exhausted ${maxRetries} retries for Gemini embedding`);
  }

  if (openai) {
    const response = await openai.embeddings.create({
      model: resolveEmbeddingModel(),
      input: text,
    });
    return response.data[0].embedding as number[];
  }

  throw new Error('No Gemini or OpenAI API key configured for embedding');
}
