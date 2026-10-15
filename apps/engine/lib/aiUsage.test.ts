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
      model: 'text-embedding-004',
      operation: 'embed',
      durationMs: 10,
      items: 50,
      promptTokens: 5000,
    });
    recordAiUsage({
      step: 'EMBED',
      provider: 'openai',
      model: 'text-embedding-3-large',
      operation: 'embed',
      durationMs: 20,
      items: 5,
      promptTokens: 1000,
    });

    expect(getAiUsageTotals()).toHaveLength(2);
    const lines = formatAiUsageLines();
    expect(lines[0]).toContain('[EMBED] gemini/text-embedding-004 embed calls=1');
    expect(lines[0]).toContain('items=50');
    expect(lines[0]).toContain('estCost=$');
    expect(lines[1]).toContain('openai/text-embedding-3-large');
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
      step: 'SUMMARIZE',
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'generate',
      durationMs: 300,
      promptTokens: 5000,
      outputTokens: 200,
    });

    const cost = getTotalAiCostUsd();
    expect(cost.geminiUsd).toBeGreaterThan(0);
    expect(cost.openaiUsd).toBeGreaterThan(0);
    expect(cost.totalUsd).toBeCloseTo(cost.geminiUsd + cost.openaiUsd, 6);
  });

  it('resets between runs', () => {
    recordAiUsage({ step: 'EMBED', provider: 'gemini', model: 'm', operation: 'embed', durationMs: 1 });
    resetAiUsage();
    expect(getAiUsageTotals()).toEqual([]);
    expect(getTotalAiCostUsd().totalUsd).toBe(0);
  });
});
