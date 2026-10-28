import OpenAI from 'openai';
import { logger, PipelineStep } from './pipelineLogger';
import { recordAiUsage } from './aiUsage';

const GEMINI_API_BASE_URL =
  process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const openai =
  OPENAI_API_KEY || process.env.NODE_ENV === 'test'
    ? new OpenAI({
        apiKey: OPENAI_API_KEY || 'mock-key',
        baseURL: process.env.OPENAI_BASE_URL,
      })
    : null;

let geminiDisabled = false;

export function isGeminiActive(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && !geminiDisabled);
}

export function resetAiClientState(): void {
  geminiDisabled = false;
}

export function resolveSummaryModel(): string {
  const envModel = process.env.SUMMARY_MODEL;
  if (
    !envModel ||
    envModel.includes('1.5') ||
    envModel.includes('2.0') ||
    envModel === 'gpt-4o-mini' ||
    envModel === 'gemini-flash-latest'
  ) {
    return isGeminiActive() ? 'gemini-flash-lite-latest' : 'gpt-4o-mini';
  }
  return envModel;
}

export function resolveEmbeddingModel(provider?: 'gemini' | 'openai'): string {
  const targetProvider = provider || (isGeminiActive() ? 'gemini' : 'openai');
  if (targetProvider === 'gemini') {
    return process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
  }
  return process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';
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

  if (geminiKey && !geminiDisabled) {
    const model = request.model || resolveSummaryModel();
    const url = `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${geminiKey}`;

    const generationConfig: Record<string, unknown> = {
      responseMimeType: 'application/json',
      temperature: request.temperature ?? 0.1,
      maxOutputTokens: request.maxTokens ?? 16384,
    };

    // Models with thinking enabled by default (e.g. gemini-flash-latest or thinking variants)
    // waste budget generating hidden reasoning tokens on structured JSON tasks.
    // Models without thinking (such as flash-lite) reject thinkingConfig, so only set when appropriate.
    if (model.includes('thinking') || model === 'gemini-flash-latest') {
      generationConfig.thinkingConfig = {
        thinkingBudget: 0,
      };
    }

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: request.prompt }] }],
      generationConfig,
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
        const startedAt = Date.now();
        const usageStep = request.step || PipelineStep.Cluster;
        let res: Response;
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(90000),
          });
        } catch (fetchErr) {
          recordAiUsage({
            step: usageStep,
            provider: 'gemini',
            model,
            operation: 'generate',
            durationMs: Date.now() - startedAt,
            failed: true,
          });
          throw fetchErr;
        }

        if (res.status === 429) {
          if (res.body && typeof res.body.cancel === 'function') {
            await res.body.cancel().catch(() => {});
          }
          recordAiUsage({
            step: usageStep,
            provider: 'gemini',
            model,
            operation: 'generate',
            durationMs: Date.now() - startedAt,
            failed: true,
          });
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
          recordAiUsage({
            step: usageStep,
            provider: 'gemini',
            model,
            operation: 'generate',
            durationMs: Date.now() - startedAt,
            failed: true,
          });
          const errorText = await res.text();
          if (res.status === 402 || res.status === 401 || res.status === 403) {
            geminiDisabled = true;
            logger.warn(
              `[${request.step || PipelineStep.Cluster}] Gemini API returned ${res.status}. Disabling Gemini for this run and falling back to OpenAI.`
            );
          }
          throw new Error(`Gemini API error (${res.status}): ${errorText}`);
        }

        const data = (await res.json()) as any;
        recordAiUsage({
          step: usageStep,
          provider: 'gemini',
          model,
          operation: 'generate',
          durationMs: Date.now() - startedAt,
          promptTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
          thoughtTokens: data.usageMetadata?.thoughtsTokenCount,
        });
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

    const openaiStartedAt = Date.now();
    const completion = await openai.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.1,
    });
    recordAiUsage({
      step: request.step || PipelineStep.Cluster,
      provider: 'openai',
      model,
      operation: 'generate',
      durationMs: Date.now() - openaiStartedAt,
      promptTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
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

  if (geminiKey && !geminiDisabled) {
    const model = resolveEmbeddingModel('gemini');
    const url = `${GEMINI_API_BASE_URL}/models/${model}:embedContent?key=${geminiKey}`;

    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          }),
          signal: AbortSignal.timeout(90000),
        });

        if (res.status === 429) {
          if (res.body && typeof res.body.cancel === 'function') {
            await res.body.cancel().catch(() => {});
          }
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
          if (res.status === 402) {
            throw new Error(`Gemini embedding API error (402): BILLING_DEPLETED - Your prepayment credits are depleted: ${errorText}`);
          }
          throw new Error(`Gemini embedding API error (${res.status}): ${errorText}`);
        }

        const data = (await res.json()) as { embedding?: { values?: number[] } };
        if (!data.embedding?.values) {
          throw new Error('Gemini embedding response missing values');
        }
        return data.embedding.values;
      }

      throw new Error(`Exhausted ${maxRetries} retries for Gemini embedding`);
    } catch (geminiError: any) {
      logger.error(
        `[${PipelineStep.Embed}] Gemini embedding failed: ${geminiError.message || geminiError}`
      );
      throw geminiError;
    }
  }

  throw new Error('GEMINI_API_KEY is required for embedding generation (fallback disabled)');
}

/**
 * Generates embedding vectors in batches using Gemini batchEmbedContents or OpenAI embeddings.
 * Chunks inputs into batches of up to 100 texts to respect Gemini batch size limits.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  maxRetries = 3
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey && !geminiDisabled) {
      const model = resolveEmbeddingModel('gemini');
      const url = `${GEMINI_API_BASE_URL}/models/${model}:batchEmbedContents?key=${geminiKey}`;

      let succeeded = false;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const batchStartedAt = Date.now();
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: chunk.map((text) => ({
                model: `models/${model}`,
                content: { parts: [{ text }] },
              })),
            }),
            signal: AbortSignal.timeout(90000),
          });

          if (res.status === 429) {
            if (res.body && typeof res.body.cancel === 'function') {
              await res.body.cancel().catch(() => {});
            }
            const backoffMs = Math.pow(2, attempt) * 2000;
            logger.warn(
              `[${PipelineStep.Embed}] Gemini rate limit (429) on batch embedding attempt ${attempt}/${maxRetries}. Backing off for ${backoffMs / 1000}s...`
            );
            if (process.env.NODE_ENV !== 'test') {
              await new Promise((r) => setTimeout(r, backoffMs));
            }
            continue;
          }

          if (!res.ok) {
            const errorText = await res.text();
            if (res.status === 402) {
              throw new Error(`Gemini batch embedding API error (402): BILLING_DEPLETED - Your prepayment credits are depleted: ${errorText}`);
            }
            throw new Error(`Gemini batch embedding API error (${res.status}): ${errorText}`);
          }

          const data = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
          if (!data.embeddings || data.embeddings.length !== chunk.length) {
            throw new Error(
              `Gemini batch embedding count mismatch: expected ${chunk.length}, got ${data.embeddings?.length ?? 0}`
            );
          }

          const batchValues: number[][] = [];
          for (const emb of data.embeddings) {
            if (!emb.values) {
              throw new Error('Gemini batch embedding item missing values');
            }
            batchValues.push(emb.values);
          }
          allEmbeddings.push(...batchValues);
          const estimatedTokens = chunk.reduce(
            (sum, text) => sum + Math.ceil(text.length / 4),
            0
          );
          recordAiUsage({
            step: PipelineStep.Embed,
            provider: 'gemini',
            model,
            operation: 'embed',
            durationMs: Date.now() - batchStartedAt,
            items: chunk.length,
            promptTokens: estimatedTokens,
          });

          succeeded = true;
          break;
        } catch (err: any) {
          if (attempt === maxRetries) {
            logger.error(
              `[${PipelineStep.Embed}] Gemini batch embedding failed: ${err.message || err}`
            );
            throw err;
          }
        }
      }

      if (!succeeded) {
        throw new Error(`Failed to generate batch embeddings after ${maxRetries} attempts`);
      }
      continue;
    }

    throw new Error('GEMINI_API_KEY is required for batch embedding generation (fallback disabled)');
  }

  return allEmbeddings;
}
