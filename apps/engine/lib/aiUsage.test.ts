import {
  recordAiUsage,
  resetAiUsage,
  getAiUsageTotals,
  formatAiUsageLines,
  getTotalAiCostUsd,
  estimateCostUsd,
} from './aiUsage';

describe('aiUsage', () => {
  beforeEach(() => resetAiUsage());

  it('aggregates calls, tokens and latency per step, provider, model and operation', () => {
    recordAiUsage({
      step: 'ORGANIZE',
      provider: 'gemini',
      model: 'gemini-flash-latest',
      operation: 'generate',
      durationMs: 1000,
      promptTokens: 100,
      outputTokens: 20,
      thoughtTokens: 300,
    });
    recordAiUsage({
      step: 'ORGANIZE',
      provider: 'gemini',
      model: 'gemini-flash-latest',
      operation: 'generate',
      durationMs: 3000,
      promptTokens: 50,
      outputTokens: 10,
      thoughtTokens: 100,
    });
    recordAiUsage({
      step: 'ORGANIZE',
      provider: 'gemini',
      model: 'gemini-flash-latest',
      operation: 'generate',
      durationMs: 500,
      failed: true,
    });

    const totals = getAiUsageTotals();
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({
      calls: 3,
      failures: 1,
      totalMs: 4500,
      maxMs: 3000,
      promptTokens: 150,
      outputTokens: 30,
      thoughtTokens: 400,
    });
  });

  it('keeps separate buckets per provider and formats readable lines with spend', () => {
    recordAiUsage({
      step: 'EMBED',
      provider: 'gemini',
      model: 'gemini-embedding-2',
      operation: 'embed',
      durationMs: 10,
      items: 50,
      promptTokens: 5000,
    });
    recordAiUsage({
      step: 'ORGANIZE',
      provider: 'typesafe',
      model: 'jev-latest',
      operation: 'judge',
      durationMs: 20,
      promptTokens: 1000,
      outputTokens: 0,
    });

    expect(getAiUsageTotals()).toHaveLength(2);
    const lines = formatAiUsageLines();
    expect(lines[0]).toContain('[EMBED] gemini/gemini-embedding-2 embed calls=1');
    expect(lines[0]).toContain('items=50');
    expect(lines[0]).toContain('estCost=$');
    expect(lines[1]).toContain('typesafe/jev-latest judge calls=1');
  });

  it('calculates total spend correctly across providers', () => {
    recordAiUsage({
      step: 'SUMMARIZE',
      provider: 'gemini',
      model: 'gemini-flash-latest',
      operation: 'generate',
      durationMs: 200,
      promptTokens: 10000,
      outputTokens: 500,
    });
    recordAiUsage({
      step: 'ORGANIZE',
      provider: 'typesafe',
      model: 'jev-latest',
      operation: 'judge',
      durationMs: 150,
      promptTokens: 2000,
      outputTokens: 0,
    });

    const cost = getTotalAiCostUsd();
    expect(cost.geminiUsd).toBeGreaterThan(0);
    expect(cost.typesafeUsd).toBeGreaterThan(0);
    expect(cost.totalUsd).toBeCloseTo(cost.geminiUsd + cost.typesafeUsd, 6);
  });

  it('resets between runs', () => {
    recordAiUsage({ step: 'EMBED', provider: 'gemini', model: 'm', operation: 'embed', durationMs: 1 });
    resetAiUsage();
    expect(getAiUsageTotals()).toEqual([]);
    expect(getTotalAiCostUsd().totalUsd).toBe(0);
  });
});
