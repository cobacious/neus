import { jest } from '@jest/globals';
import {
  callSystemOne,
  classifyArticleAngle,
  classifyArticleAnglesBatch,
  verifyDuplicateClusters,
  detectDuplicateClusters,
  verifySagaRelationship,
  verifyStoryMembership,
  detectStorySagas,
  isTypeSafeActive,
} from './typesafeClient';
import { getAiUsageTotals, resetAiUsage } from './aiUsage';

const originalEnv = process.env;

describe('typesafeClient', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    resetAiUsage();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isTypeSafeActive', () => {
    it('returns true when TYPESAFE_API_KEY is present', () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';
      expect(isTypeSafeActive()).toBe(true);
    });

    it('returns false when TYPESAFE_API_KEY is absent', () => {
      delete process.env.TYPESAFE_API_KEY;
      expect(isTypeSafeActive()).toBe(false);
    });
  });

  describe('callSystemOne', () => {
    it('throws error when TYPESAFE_API_KEY is missing', async () => {
      delete process.env.TYPESAFE_API_KEY;
      await expect(
        callSystemOne({
          state: 'test',
          questions: {
            q1: { type: 'noul', instructions: 'Is this true?' },
          },
        })
      ).rejects.toThrow('TYPESAFE_API_KEY is not configured');
    });

    it('records usage and returns answers on successful call', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockResponse = {
        model: 'jev-1.14.0',
        answers: {
          choice_q: {
            type: 'choice',
            choice: 'option_a',
            confidence: 0.95,
            probabilities: { option_a: 0.95, option_b: 0.05 },
          },
        },
        usage: {
          input_tokens: 350,
          output_tokens: 42,
        },
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await callSystemOne({
        state: { text: 'sample state' },
        questions: {
          choice_q: {
            type: 'choice',
            instructions: 'Select option',
            criteria: { option_a: 'First option', option_b: 'Second option' },
          },
        },
      });

      expect(result.model).toBe('jev-1.14.0');
      expect(result.answers.choice_q).toMatchObject({
        type: 'choice',
        choice: 'option_a',
        confidence: 0.95,
      });

      const totals = getAiUsageTotals();
      expect(totals).toHaveLength(1);
      expect(totals[0]).toMatchObject({
        provider: 'typesafe',
        model: 'jev-1.14.0',
        operation: 'judge',
        promptTokens: 350,
        outputTokens: 42,
        failures: 0,
      });
    });
  });

  describe('classifyArticleAngle', () => {
    it('assigns article to matching angle cluster ID', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-1.14.0',
          answers: {
            angle: {
              type: 'choice',
              choice: 'angle_c123',
              confidence: 0.92,
              probabilities: { angle_c123: 0.92, angle_c456: 0.08, none_of_the_above: 0.0 },
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await classifyArticleAngle({
        article: {
          id: 'art_1',
          title: 'Police declare major incident after fatal tiger attack',
          snippet: 'Emergency services remain at the Doncaster zoo following death of female keeper.',
        },
        angles: [
          {
            clusterId: 'c123',
            angle: 'Police inquiry and criminal investigation',
            headline: 'Police launch investigation into tiger enclosure death',
          },
          {
            clusterId: 'c456',
            angle: 'Zoo management safety protocol review',
            headline: 'Wildlife park undertakes urgent enclosure reviews',
          },
        ],
        storyTitle: 'Fatal Tiger Incident at Yorkshire Wildlife Park',
      });

      expect(result.targetClusterId).toBe('c123');
      expect(result.confidence).toBe(0.92);
      expect(result.choice).toBe('angle_c123');
    });

    it('returns targetClusterId null when choice is none_of_the_above', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-1.14.0',
          answers: {
            angle: {
              type: 'choice',
              choice: 'none_of_the_above',
              confidence: 0.88,
              probabilities: { angle_c123: 0.05, none_of_the_above: 0.88 },
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await classifyArticleAngle({
        article: {
          id: 'art_2',
          title: 'Unrelated court trial begins in Leeds for burglary',
        },
        angles: [
          {
            clusterId: 'c123',
            angle: 'Police inquiry',
          },
        ],
      });

      expect(result.targetClusterId).toBeNull();
      expect(result.choice).toBe('none_of_the_above');
    });

    it('returns targetClusterId null when confidence is below minConfidence threshold', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-1.14.0',
          answers: {
            angle: {
              type: 'choice',
              choice: 'angle_c123',
              confidence: 0.35, // Below default 0.45 threshold
              probabilities: { angle_c123: 0.40, angle_c456: 0.38, none_of_the_above: 0.22 },
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await classifyArticleAngle({
        article: {
          id: 'art_3',
          title: 'General comments on animal captivity',
        },
        angles: [
          { clusterId: 'c123', angle: 'Police inquiry' },
          { clusterId: 'c456', angle: 'Park management' },
        ],
        minConfidence: 0.45,
      });

      expect(result.targetClusterId).toBeNull();
      expect(result.confidence).toBe(0.35);
    });
  });

  describe('classifyArticleAnglesBatch', () => {
    it('processes batch of articles concurrently', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            model: 'jev-1.14.0',
            answers: {
              angle: {
                type: 'choice',
                choice: 'angle_c1',
                confidence: 0.90,
                probabilities: { angle_c1: 0.90, none_of_the_above: 0.10 },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            model: 'jev-1.14.0',
            answers: {
              angle: {
                type: 'choice',
                choice: 'none_of_the_above',
                confidence: 0.85,
                probabilities: { angle_c1: 0.15, none_of_the_above: 0.85 },
              },
            },
          }),
        });
      global.fetch = mockFetch;

      const results = await classifyArticleAnglesBatch({
        articles: [
          { id: 'art_1', title: 'Article 1 matching angle' },
          { id: 'art_2', title: 'Article 2 not matching' },
        ],
        angles: [{ clusterId: 'c1', angle: 'Specific angle' }],
        concurrency: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        articleId: 'art_1',
        targetClusterId: 'c1',
        confidence: 0.90,
      });
      expect(results[1]).toMatchObject({
        articleId: 'art_2',
        targetClusterId: null,
        confidence: 0.85,
      });
    });
  });

  describe('verifyDuplicateClusters', () => {
    it('identifies duplicate clusters when noul probability >= 0.85', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-1.14.0',
          answers: {
            is_same_event: {
              type: 'noul',
              noul: 0.94,
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await verifyDuplicateClusters({
        clusterA: {
          title: 'Keeper dies in tiger enclosure incident at Doncaster park',
        },
        clusterB: {
          title: 'Fatal big cat attack at Yorkshire Wildlife Park under inquiry',
        },
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.probability).toBe(0.94);
    });

    it('identifies distinct events when noul probability < 0.85', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-1.14.0',
          answers: {
            is_same_event: {
              type: 'noul',
              noul: 0.12,
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await verifyDuplicateClusters({
        clusterA: {
          title: 'Keeper dies in tiger enclosure incident',
        },
        clusterB: {
          title: 'Chester Zoo welcomes rare baby chimpanzee birth',
        },
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.probability).toBe(0.12);
    });
  });

  describe('detectDuplicateClusters', () => {
    it('returns empty array when fewer than 2 clusters are provided', async () => {
      const result = await detectDuplicateClusters([]);
      expect(result).toEqual([]);
    });

    it('skips pairs below cosine threshold', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      const clusters = [
        {
          id: 'c1',
          headline: 'Cluster 1',
          articleCount: 3,
          createdAt: new Date(),
          embedding: [1, 0, 0],
        },
        {
          id: 'c2',
          headline: 'Cluster 2',
          articleCount: 2,
          createdAt: new Date(),
          embedding: [0, 1, 0], // Orthogonal -> cosine 0 < 0.78
        },
      ];

      const merges = await detectDuplicateClusters(clusters);
      expect(merges).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('identifies and returns merge decision when cosine >= threshold and Jev probability >= 0.85', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-1.14.0',
          answers: {
            is_same_event: {
              type: 'noul',
              noul: 0.92,
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const clusters = [
        {
          id: 'c1-target',
          headline: 'Fatal tiger incident at Doncaster wildlife park',
          articleCount: 5,
          createdAt: new Date('2026-10-20T10:00:00Z'),
          embedding: [0.95, 0.05, 0],
        },
        {
          id: 'c2-source',
          headline: 'Keeper dies in tiger enclosure attack',
          articleCount: 2,
          createdAt: new Date('2026-10-20T10:15:00Z'),
          embedding: [0.94, 0.06, 0], // High cosine similarity
        },
      ];

      const merges = await detectDuplicateClusters(clusters);
      expect(merges).toHaveLength(1);
      expect(merges[0]).toEqual({
        targetClusterId: 'c1-target',
        sourceClusterIds: ['c2-source'],
      });
    });
  });

  describe('verifySagaRelationship', () => {
    it('returns isSameSaga true when Jev returns probability >= 0.85', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-1.14.0',
          answers: {
            is_same_saga: {
              type: 'noul',
              noul: 0.94,
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await verifySagaRelationship({
        clusterA: { title: 'Tiger enclosure breach kills keeper', summary: 'Incident at wildlife park' },
        clusterB: { title: 'Council opens health and safety inquiry into zoo attack', summary: 'Official investigation' },
      });

      expect(result.isSameSaga).toBe(true);
      expect(result.probability).toBe(0.94);
    });

    it('returns isSameSaga false when Jev returns probability < 0.85', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-1.14.0',
          answers: {
            is_same_saga: {
              type: 'noul',
              noul: 0.42,
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await verifySagaRelationship({
        clusterA: { title: 'Tiger enclosure breach kills keeper', summary: 'Incident at wildlife park' },
        clusterB: { title: 'Chester Zoo announces birth of rare black rhino', summary: 'Zoo breeding success' },
      });

      expect(result.isSameSaga).toBe(false);
      expect(result.probability).toBe(0.42);
    });
  });

  describe('verifyStoryMembership', () => {
    it('returns isMember true when Jev returns probability >= 0.85', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'jev-1.14.0',
          answers: {
            is_member: {
              type: 'noul',
              noul: 0.91,
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await verifyStoryMembership({
        cluster: { title: 'Ministers announce new scrutiny panel', summary: 'Follow-up inquiry' },
        story: { title: 'Yorkshire Wildlife Park Tiger Incident', overview: 'Fatal tiger attack and aftermath' },
      });

      expect(result.isMember).toBe(true);
      expect(result.probability).toBe(0.91);
    });
  });

  describe('detectStorySagas', () => {
    it('returns empty array when fewer than 2 clusters are provided', async () => {
      const result = await detectStorySagas([{ id: 'c1', createdAt: new Date() }]);
      expect(result).toEqual([]);
    });

    it('returns empty array when TYPESAFE_API_KEY is not configured', async () => {
      delete process.env.TYPESAFE_API_KEY;
      const result = await detectStorySagas([
        { id: 'c1', createdAt: new Date() },
        { id: 'c2', createdAt: new Date() },
      ]);
      expect(result).toEqual([]);
    });

    it('identifies new story sagas using pairwise relationships and connected components', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockImplementation(async (url: any, opts: any) => {
        const body = JSON.parse(opts.body);
        const headlineA = body.state.storyA?.headline || '';
        const headlineB = body.state.storyB?.headline || '';

        // c1 and c2 are related; c3 is unrelated
        const isRelated =
          (headlineA.includes('attack') && headlineB.includes('investigation')) ||
          (headlineA.includes('investigation') && headlineB.includes('attack'));

        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: 'jev-1.14.0',
            answers: {
              is_same_saga: {
                type: 'noul',
                noul: isRelated ? 0.95 : 0.2,
              },
            },
          }),
        };
      });
      global.fetch = mockFetch as any;

      const clusters = [
        { id: 'c1', headline: 'Tiger attack at Doncaster park', createdAt: new Date() },
        { id: 'c2', headline: 'Council launches investigation into safety protocols', createdAt: new Date() },
        { id: 'c3', headline: 'Unrelated local traffic update', createdAt: new Date() },
      ];

      const sagas = await detectStorySagas(clusters);

      expect(sagas).toHaveLength(1);
      expect(sagas[0]).toEqual({
        existingStoryId: null,
        clusterIds: ['c1', 'c2'],
      });
    });

    it('matches clusters to existing candidate stories', async () => {
      process.env.TYPESAFE_API_KEY = 'mock_key';

      const mockFetch = jest.fn().mockImplementation(async (url: any, opts: any) => {
        const body = JSON.parse(opts.body);
        const isMember = (body.state.cluster?.headline || '').includes('Pike');

        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: 'jev-1.14.0',
            answers: {
              is_member: {
                type: 'noul',
                noul: isMember ? 0.95 : 0.1,
              },
            },
          }),
        };
      });
      global.fetch = mockFetch as any;

      const clusters = [
        { id: 'c1', headline: 'Pike survives lethal injection', createdAt: new Date() },
        { id: 'c2', headline: 'Pike transferred to ICU ward', createdAt: new Date() },
      ];

      const candidateStories = [
        { id: 'story-pike', title: 'Christa Pike Execution Saga', overview: 'Lethal injection attempt and fallout' },
      ];

      const sagas = await detectStorySagas(clusters, candidateStories);

      expect(sagas).toHaveLength(1);
      expect(sagas[0]).toEqual({
        existingStoryId: 'story-pike',
        clusterIds: ['c1', 'c2'],
      });
    });
  });
});
