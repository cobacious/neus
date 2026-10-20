import {
  evaluatePulseTrigger,
  extractKeywords,
  findSurgeCluster,
  localCosineSimilarity,
  PulseArticle,
} from './evaluatePulseTrigger';

describe('Pulse Trigger Evaluator', () => {
  const NOW = 1700000000000;
  const TEN_MINS_AGO = new Date(NOW - 10 * 60 * 1000);
  const FIFTY_MINS_AGO = new Date(NOW - 50 * 60 * 1000);

  const baseVector = [1, 0, 0];
  const identicalVector = [1, 0, 0];
  const orthogonalVector = [0, 1, 0];

  describe('localCosineSimilarity & extractKeywords', () => {
    it('computes cosine similarity accurately', () => {
      expect(localCosineSimilarity([1, 0], [1, 0])).toBe(1);
      expect(localCosineSimilarity([1, 0], [0, 1])).toBe(0);
      expect(localCosineSimilarity([0, 0], [1, 1])).toBe(0);
    });

    it('extracts significant keywords ignoring common stopwords', () => {
      const keywords = extractKeywords('Major fire breaks out at London Heathrow Airport terminal');
      expect(keywords.has('fire')).toBe(true);
      expect(keywords.has('heathrow')).toBe(true);
      expect(keywords.has('airport')).toBe(true);
      expect(keywords.has('london')).toBe(true);
      expect(keywords.has('terminal')).toBe(true);
      expect(keywords.has('at')).toBe(false);
      expect(keywords.has('the')).toBe(false);
    });
  });

  describe('findSurgeCluster', () => {
    it('detects breaking surge via vector embeddings', () => {
      const articles: PulseArticle[] = [
        { id: '1', title: 'Airport fire', sourceId: 'bbc', publishedAt: TEN_MINS_AGO, embedding: baseVector },
        { id: '2', title: 'Airport fire details', sourceId: 'guardian', publishedAt: TEN_MINS_AGO, embedding: identicalVector },
        { id: '3', title: 'Emergency at airport', sourceId: 'sky', publishedAt: TEN_MINS_AGO, embedding: identicalVector },
      ];

      const surge = findSurgeCluster(articles, 3, 0.88);
      expect(surge).toBeDefined();
      expect(surge?.uniqueSources).toBe(3);
      expect(surge?.method).toBe('embedding');
    });

    it('detects breaking surge via lexical keywords when embeddings are null', () => {
      const articles: PulseArticle[] = [
        { id: '1', title: 'Major fire breaks out at London Heathrow Airport', sourceId: 'bbc', publishedAt: TEN_MINS_AGO, embedding: null },
        { id: '2', title: 'Heathrow Airport fire grounds flights across capital', sourceId: 'guardian', publishedAt: TEN_MINS_AGO, embedding: null },
        { id: '3', title: 'Emergency crews tackle large fire at Heathrow Airport', sourceId: 'sky', publishedAt: TEN_MINS_AGO, embedding: null },
      ];

      const surge = findSurgeCluster(articles, 3, 0.88);
      expect(surge).toBeDefined();
      expect(surge?.uniqueSources).toBe(3);
      expect(surge?.method).toBe('lexical');
    });

    it('does not trigger lexical surge when stories are distinct', () => {
      const articles: PulseArticle[] = [
        { id: '1', title: 'Stock markets rise after tech earnings', sourceId: 'ft', publishedAt: TEN_MINS_AGO },
        { id: '2', title: 'Premier League weekend roundup and results', sourceId: 'bbc', publishedAt: TEN_MINS_AGO },
        { id: '3', title: 'Heathrow airport plans third runway expansion', sourceId: 'sky', publishedAt: TEN_MINS_AGO },
      ];

      const surge = findSurgeCluster(articles, 3, 0.88);
      expect(surge).toBeUndefined();
    });
  });

  describe('evaluatePulseTrigger', () => {
    it('blocks trigger when a pipeline run is already in progress', () => {
      const res = evaluatePulseTrigger({
        isRunInProgress: true,
        minutesSinceLastRun: 180,
        unclusteredArticleCount: 100,
        recentArticles: [],
        now: NOW,
      });

      expect(res.shouldTrigger).toBe(false);
      expect(res.reason).toBe('run_in_progress');
    });

    it('blocks trigger when cooldown is active (< 60m)', () => {
      const res = evaluatePulseTrigger({
        isRunInProgress: false,
        minutesSinceLastRun: 35,
        unclusteredArticleCount: 100,
        recentArticles: [],
        now: NOW,
      });

      expect(res.shouldTrigger).toBe(false);
      expect(res.reason).toBe('cooldown_active');
    });

    it('triggers on breaking surge across >= 3 sources', () => {
      const recentArticles: PulseArticle[] = [
        { id: '1', title: 'Plane crash in Baltic Sea', sourceId: 'bbc', publishedAt: TEN_MINS_AGO },
        { id: '2', title: 'Plane crash reported in Baltic Sea', sourceId: 'reuters', publishedAt: TEN_MINS_AGO },
        { id: '3', title: 'Aircraft crash into Baltic Sea confirms rescue', sourceId: 'guardian', publishedAt: TEN_MINS_AGO },
      ];

      const res = evaluatePulseTrigger({
        isRunInProgress: false,
        minutesSinceLastRun: 75,
        unclusteredArticleCount: 10,
        recentArticles,
        now: NOW,
      });

      expect(res.shouldTrigger).toBe(true);
      expect(res.reason).toBe('breaking_surge');
      expect(res.surgeCluster?.uniqueSources).toBe(3);
    });

    it('triggers on batch volume threshold (>= 45 unclustered articles)', () => {
      const res = evaluatePulseTrigger({
        isRunInProgress: false,
        minutesSinceLastRun: 90,
        unclusteredArticleCount: 48,
        recentArticles: [],
        now: NOW,
      });

      expect(res.shouldTrigger).toBe(true);
      expect(res.reason).toBe('batch_threshold');
    });

    it('triggers on heartbeat staleness (>= 6 hours)', () => {
      const res = evaluatePulseTrigger({
        isRunInProgress: false,
        minutesSinceLastRun: 365,
        unclusteredArticleCount: 12,
        recentArticles: [],
        now: NOW,
      });

      expect(res.shouldTrigger).toBe(true);
      expect(res.reason).toBe('heartbeat_staleness');
    });

    it('returns insufficient_activity during quiet periods under cooldown', () => {
      const res = evaluatePulseTrigger({
        isRunInProgress: false,
        minutesSinceLastRun: 70,
        unclusteredArticleCount: 15,
        recentArticles: [],
        now: NOW,
      });

      expect(res.shouldTrigger).toBe(false);
      expect(res.reason).toBe('insufficient_activity');
    });
  });
});
