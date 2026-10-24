/**
 * In-memory tracker for AI calls made during a single pipeline run.
 * Records call counts, token usage, latency and estimated spend per
 * (step, provider, model, operation) so we can see exactly where time and spend go.
 */

export type AiProvider = 'gemini' | 'openai' | 'typesafe';
export type AiOperation = 'generate' | 'embed' | 'judge';

export interface AiUsageRecord {
  step: string;
  provider: AiProvider;
  model: string;
  operation: AiOperation;
  /** Wall-clock duration of the call in milliseconds. */
  durationMs: number;
  promptTokens?: number;
  outputTokens?: number;
  /** Hidden reasoning tokens (Gemini thoughtsTokenCount), billed as output. */
  thoughtTokens?: number;
  /** Number of items in a batch embedding call. */
  items?: number;
  failed?: boolean;
}

export interface AiUsageTotals {
  step: string;
  provider: AiProvider;
  model: string;
  operation: AiOperation;
  calls: number;
  failures: number;
  totalMs: number;
  maxMs: number;
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  items: number;
  estimatedCostUsd: number;
}

/**
 * AI Provider Rate Card (USD per 1,000,000 tokens).
 *
 * NOTE: As of 16/10/2026: Check and update periodically against official provider pricing sheets:
 * - Google Cloud & AI Studio: https://ai.google.dev/pricing
 * - OpenAI Platform: https://openai.com/api/pricing/
 *
 * NOTE ON GEMINI CALIBRATION:
 * While Google AI Studio lists theoretical promotional rates of $0.075/1M input and $0.30/1M output
 * for Flash-Lite, active Google Cloud Billing pay-as-you-go accounts deduct against standard Flash
 * SKUs at up to $0.75/1M input and $3.75/1M output. We calculate generative Gemini spend at $0.75/$3.75
 * so the pipeline telemetry reflects realistic worst-case billing deductions rather than under-reporting spend.
 */
export const PRICING_LAST_VERIFIED = '2026-10-16';

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  notes?: string;
}

export const AI_MODEL_PRICING: Record<string, ModelPricing> = {
  // Google Gemini Models (as of 16/10/2026)
  'gemini-embedding-2': {
    inputPerMillion: 0.20,
    outputPerMillion: 0,
    notes: 'Standard text embedding rate',
  },
  'gemini-flash-latest': {
    inputPerMillion: 0.75,
    outputPerMillion: 3.75,
    notes: 'Conservative Google Cloud Billing pay-as-you-go rate for Flash generative calls',
  },
  // OpenAI Models (as of 16/10/2026)
  'gpt-4o-mini': {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
    notes: 'OpenAI gpt-4o-mini standard tier',
  },
  'text-embedding-3-large': {
    inputPerMillion: 0.13,
    outputPerMillion: 0,
    notes: 'OpenAI 3072-dimension embeddings',
  },
  'text-embedding-3-small': {
    inputPerMillion: 0.02,
    outputPerMillion: 0,
    notes: 'OpenAI 1536-dimension embeddings',
  },
  // TypeSafe Models (as of 23/10/2026)
  'jev-latest': {
    inputPerMillion: 0.042,
    outputPerMillion: 0.0,
    notes: 'TypeSafe System One flagship model (free output tokens)',
  },
  'jev-preview': {
    inputPerMillion: 0.042,
    outputPerMillion: 0.0,
    notes: 'TypeSafe System One preview model (free output tokens)',
  },
};

/**
 * Converts USD spend to GBP including 20% UK VAT (approx $1.30 per £1 exchange rate).
 */
export function usdToGbpWithVat(usd: number): number {
  return (usd / 1.30) * 1.20;
}

export function estimateCostUsd(
  provider: AiProvider,
  model: string,
  promptTokens: number,
  outputTokens: number,
  thoughtTokens: number = 0
): number {
  const totalOutput = outputTokens + thoughtTokens;

  if (provider === 'gemini') {
    if (model.includes('embedding')) {
      const rate = AI_MODEL_PRICING['gemini-embedding-2'].inputPerMillion;
      return (promptTokens * rate) / 1_000_000;
    }
    const rate = AI_MODEL_PRICING['gemini-flash-latest'];
    return (promptTokens * rate.inputPerMillion + totalOutput * rate.outputPerMillion) / 1_000_000;
  }

  if (provider === 'openai') {
    if (model.includes('gpt-4o-mini')) {
      const rate = AI_MODEL_PRICING['gpt-4o-mini'];
      return (promptTokens * rate.inputPerMillion + totalOutput * rate.outputPerMillion) / 1_000_000;
    }
    if (model.includes('embedding-3-large')) {
      const rate = AI_MODEL_PRICING['text-embedding-3-large'].inputPerMillion;
      return (promptTokens * rate) / 1_000_000;
    }
    if (model.includes('embedding-3-small')) {
      const rate = AI_MODEL_PRICING['text-embedding-3-small'].inputPerMillion;
      return (promptTokens * rate) / 1_000_000;
    }
    const fallbackRate = AI_MODEL_PRICING['gpt-4o-mini'];
    return (
      (promptTokens * fallbackRate.inputPerMillion + totalOutput * fallbackRate.outputPerMillion) /
      1_000_000
    );
  }

  if (provider === 'typesafe') {
    const pricing = AI_MODEL_PRICING[model] || AI_MODEL_PRICING['jev-latest'];
    return (
      (promptTokens * pricing.inputPerMillion + totalOutput * pricing.outputPerMillion) /
      1_000_000
    );
  }

  return 0;
}

const totals = new Map<string, AiUsageTotals>();

export function resetAiUsage(): void {
  totals.clear();
}

export function recordAiUsage(record: AiUsageRecord): void {
  const key = [record.step, record.provider, record.model, record.operation].join('|');
  let entry = totals.get(key);
  if (!entry) {
    entry = {
      step: record.step,
      provider: record.provider,
      model: record.model,
      operation: record.operation,
      calls: 0,
      failures: 0,
      totalMs: 0,
      maxMs: 0,
      promptTokens: 0,
      outputTokens: 0,
      thoughtTokens: 0,
      items: 0,
      estimatedCostUsd: 0,
    };
    totals.set(key, entry);
  }
  entry.calls += 1;
  if (record.failed) entry.failures += 1;
  entry.totalMs += record.durationMs;
  entry.maxMs = Math.max(entry.maxMs, record.durationMs);

  const prompt = record.promptTokens ?? 0;
  const output = record.outputTokens ?? 0;
  const thought = record.thoughtTokens ?? 0;

  entry.promptTokens += prompt;
  entry.outputTokens += output;
  entry.thoughtTokens += thought;
  entry.items += record.items ?? 0;

  entry.estimatedCostUsd += estimateCostUsd(
    record.provider,
    record.model,
    prompt,
    output,
    thought
  );
}

export function getAiUsageTotals(): AiUsageTotals[] {
  return Array.from(totals.values()).sort(
    (a, b) => a.step.localeCompare(b.step) || a.provider.localeCompare(b.provider)
  );
}

export function getTotalAiCostUsd(): {
  totalUsd: number;
  geminiUsd: number;
  openaiUsd: number;
  typesafeUsd: number;
  totalGbpVat: number;
} {
  let totalUsd = 0;
  let geminiUsd = 0;
  let openaiUsd = 0;
  let typesafeUsd = 0;

  for (const t of totals.values()) {
    totalUsd += t.estimatedCostUsd;
    if (t.provider === 'gemini') geminiUsd += t.estimatedCostUsd;
    if (t.provider === 'openai') openaiUsd += t.estimatedCostUsd;
    if (t.provider === 'typesafe') typesafeUsd += t.estimatedCostUsd;
  }

  const totalGbpVat = usdToGbpWithVat(totalUsd);
  return { totalUsd, geminiUsd, openaiUsd, typesafeUsd, totalGbpVat };
}

/** One human readable line per bucket, suitable for the pipeline log. */
export function formatAiUsageLines(): string[] {
  return getAiUsageTotals().map((t) => {
    const avgMs = t.calls > 0 ? Math.round(t.totalMs / t.calls) : 0;
    const gbpCost = usdToGbpWithVat(t.estimatedCostUsd);
    const parts = [
      `${t.provider}/${t.model} ${t.operation}`,
      `calls=${t.calls}`,
      `failed=${t.failures}`,
      `avgMs=${avgMs}`,
      `maxMs=${t.maxMs}`,
      `promptTokens=${t.promptTokens}`,
      `outputTokens=${t.outputTokens}`,
      `thoughtTokens=${t.thoughtTokens}`,
      `estCost=$${t.estimatedCostUsd.toFixed(4)} (~£${gbpCost.toFixed(4)} inc VAT)`,
    ];
    if (t.items > 0) parts.push(`items=${t.items}`);
    return `[${t.step}] ${parts.join(' ')}`;
  });
}
