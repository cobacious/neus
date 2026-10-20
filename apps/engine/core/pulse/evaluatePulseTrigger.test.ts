import {
  evaluatePulseTrigger,
  findSurgeCluster,
  PulseArticle,
} from './evaluatePulseTrigger';

describe('evaluatePulseTrigger', () => {
  const now = Date.now();
  const TEN_MINS_AGO = new Date(now - 10 * 60 * 1000);
  const FIFTY_MINS_AGO = new Date(now - 50 * 60 * 1000);

  // Normalized embedding vectors
  const baseVector = [1, 0, 0];
  const identicalVector = [1, 0, 0];
  const orthogonalVector = [0, 1, 0];

  it('blocks trigger when a pipeline run is currently in progress', () => {
    const result = evaluatePulseTrigger({
      isRunInProgress: true,
      minutesSinceLastRun: 120,
      unclusteredArticleCount: 100,
      recentArticles: [],
      now,
    });

    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toBe('run_in_progress');
  });

  it('blocks trigger when cooldown is active (< 60 minutes since last run)', () => {
    const result = evaluatePulseTrigger({
      isRunInProgress: false,
      minutesSinceLastRun: 25,
      unclusteredArticleCount: 80,
      recentArticles: [],
      now,
    });

    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toBe('cooldown_active');
  });

  it('triggers immediately on breaking surge across 3 distinct sources within window', () => {
    const recentArticles: PulseArticle[] = [
      { id: '1', title: 'Major Incident at Airport', sourceId: 'bbc', publishedAt: TEN_MINS_AGO, embedding: baseVector },
      { id: '2', title: 'Airport Incident Confirmed', sourceId: 'guardian', publishedAt: TEN_MINS_AGO, embedding: identicalVector },
      { id: '3', title: 'Emergency Services at Airport', sourceId: 'sky', publishedAt: TEN_MINS_AGO, embedding: identicalVector },
    ];

    const result = evaluatePulseTrigger({
      isRunInProgress: false,
      minutesSinceLastRun: 75,
      unclusteredArticleCount: 10,
      recentArticles,
      now,
    });

    expect(result.shouldTrigger).toBe(true);
    expect(result.reason).toBe('breaking_surge');
    expect(result.surgeCluster).toBeDefined();
    expect(result.surgeCluster?.uniqueSources).toBe(3);
    expect(result.surgeCluster?.titles).toHaveLength(3);
  });

  it('does not trigger breaking surge if articles do not meet similarity threshold', () => {
    const recentArticles: PulseArticle[] = [
      { id: '1', title: 'Stock Markets Rally', sourceId: 'ft', publishedAt: TEN_MINS_AGO, embedding: baseVector },
      { id: '2', title: 'Local Sports Match Concludes', sourceId: 'bbc', publishedAt: TEN_MINS_AGO, embedding: orthogonalVector },
      { id: '3', title: 'Weather Forecast Sunny', sourceId: 'guardian', publishedAt: TEN_MINS_AGO, embedding: [0, 0, 1] },
    ];

    const result = evaluatePulseTrigger({
      isRunInProgress: false,
      minutesSinceLastRun: 75,
      unclusteredArticleCount: 10,
      recentArticles,
      now,
    });

    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toBe('insufficient_activity');
  });

  it('does not trigger breaking surge if articles come from fewer than 3 distinct sources', () => {
    // 3 articles but all from the same tabloid source (single-source spam)
    const recentArticles: PulseArticle[] = [
      { id: '1', title: 'Exclusive Celebrity Rumor', sourceId: 'tabloid', publishedAt: TEN_MINS_AGO, embedding: baseVector },
      { id: '2', title: 'Celebrity Rumor Details', sourceId: 'tabloid', publishedAt: TEN_MINS_AGO, embedding: identicalVector },
      { id: '3', title: 'More Celebrity Gossip', sourceId: 'tabloid', publishedAt: TEN_MINS_AGO, embedding: identicalVector },
    ];

    const result = evaluatePulseTrigger({
      isRunInProgress: false,
      minutesSinceLastRun: 75,
      unclusteredArticleCount: 10,
      recentArticles,
      now,
    });

    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toBe('insufficient_activity');
  });

  it('does not trigger breaking surge if articles fall outside the surge window (> 45m)', () => {
    const recentArticles: PulseArticle[] = [
      { id: '1', title: 'Old Incident', sourceId: 'bbc', publishedAt: FIFTY_MINS_AGO, embedding: baseVector },
      { id: '2', title: 'Old Incident', sourceId: 'guardian', publishedAt: FIFTY_MINS_AGO, embedding: identicalVector },
      { id: '3', title: 'Old Incident', sourceId: 'sky', publishedAt: FIFTY_MINS_AGO, embedding: identicalVector },
    ];

    const result = evaluatePulseTrigger({
      isRunInProgress: false,
      minutesSinceLastRun: 75,
      unclusteredArticleCount: 10,
      recentArticles,
      now,
    });

    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toBe('insufficient_activity');
  });

  it('triggers on batch accumulation threshold when unclustered articles >= 45', () => {
    const result = evaluatePulseTrigger({
      isRunInProgress: false,
      minutesSinceLastRun: 90,
      unclusteredArticleCount: 45,
      recentArticles: [],
      now,
    });

    expect(result.shouldTrigger).toBe(true);
    expect(result.reason).toBe('batch_threshold');
  });

  it('triggers on heartbeat staleness when >= 6 hours have elapsed since last run', () => {
    const result = evaluatePulseTrigger({
      isRunInProgress: false,
      minutesSinceLastRun: 360, // 6 hours
      unclusteredArticleCount: 8,
      recentArticles: [],
      now,
    });

    expect(result.shouldTrigger).toBe(true);
    expect(result.reason).toBe('heartbeat_staleness');
  });

  it('returns insufficient_activity during quiet periods', () => {
    const result = evaluatePulseTrigger({
      isRunInProgress: false,
      minutesSinceLastRun: 120, // 2 hours
      unclusteredArticleCount: 15,
      recentArticles: [],
      now,
    });

    expect(result.shouldTrigger).toBe(false);
    expect(result.reason).toBe('insufficient_activity');
  });

  it('respects custom configuration overrides', () => {
    const result = evaluatePulseTrigger({
      isRunInProgress: false,
      minutesSinceLastRun: 45,
      unclusteredArticleCount: 20,
      recentArticles: [],
      now,
      config: {
        cooldownMinutes: 30, // Override cooldown to 30m
        batchArticleThreshold: 20, // Override threshold to 20
      },
    });

    expect(result.shouldTrigger).toBe(true);
    expect(result.reason).toBe('batch_threshold');
  });
});
