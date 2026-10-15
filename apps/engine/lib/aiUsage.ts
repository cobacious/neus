/**
 * In-memory tracker for AI calls made during a single pipeline run.
 * Records call counts, token usage, latency and estimated spend per
 * (step, provider, model, operation) so we can see exactly where time and spend go.
 */

export type AiProvider = 'gemini' | 'openai';
export type AiOperation = 'generate' | 'embed';

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

export function estimateCostUsd(
  provider: AiProvider,
  model: string,
  promptTokens: number,
  outputTokens: number,
  thoughtTokens: number = 0
): number {
  const totalOutput = outputTokens + thoughtTokens;

  if (provider === 'gemini') {
    if (model.includes('flash')) {
      // Gemini Flash pricing: $0.075/1M input, $0.30/1M output
      return (promptTokens * 0.075 + totalOutput * 0.3) / 1_000_000;
    }
    if (model.includes('embedding')) {
      // Gemini Embeddings: ~$0.025/1M tokens
      return (promptTokens * 0.025) / 1_000_000;
    }
    return (promptTokens * 0.075 + totalOutput * 0.3) / 1_000_000;
  }

  if (provider === 'openai') {
    if (model.includes('gpt-4o-mini')) {
      // gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output
      return (promptTokens * 0.15 + totalOutput * 0.6) / 1_000_000;
    }
    if (model.includes('embedding-3-large')) {
      return (promptTokens * 0.13) / 1_000_000;
    }
    if (model.includes('embedding-3-small')) {
      return (promptTokens * 0.02) / 1_000_000;
    }
    return (promptTokens * 0.15 + totalOutput * 0.6) / 1_000_000;
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
} {
  let totalUsd = 0;
  let geminiUsd = 0;
  let openaiUsd = 0;

  for (const t of totals.values()) {
    totalUsd += t.estimatedCostUsd;
    if (t.provider === 'gemini') geminiUsd += t.estimatedCostUsd;
    if (t.provider === 'openai') openaiUsd += t.estimatedCostUsd;
  }

  return { totalUsd, geminiUsd, openaiUsd };
}

/** One human readable line per bucket, suitable for the pipeline log. */
export function formatAiUsageLines(): string[] {
  return getAiUsageTotals().map((t) => {
    const avgMs = t.calls > 0 ? Math.round(t.totalMs / t.calls) : 0;
    const parts = [
      `${t.provider}/${t.model} ${t.operation}`,
      `calls=${t.calls}`,
      `failed=${t.failures}`,
      `avgMs=${avgMs}`,
      `maxMs=${t.maxMs}`,
      `promptTokens=${t.promptTokens}`,
      `outputTokens=${t.outputTokens}`,
      `thoughtTokens=${t.thoughtTokens}`,
      `estCost=$${t.estimatedCostUsd.toFixed(4)}`,
    ];
    if (t.items > 0) parts.push(`items=${t.items}`);
    return `[${t.step}] ${parts.join(' ')}`;
  });
}
