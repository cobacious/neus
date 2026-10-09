import { jest } from '@jest/globals';

const mockDb = {
  getActiveClustersForStories: jest.fn(),
  syncStoryWithAngles: jest.fn(),
  mergeClusters: jest.fn(),
  getStoriesForMatching: jest.fn(),
  markDormantStories: jest.fn(),
  getStoryArticlesForRealignment: jest.fn(),
  realignStoryArticles: jest.fn(),
  dissociateClusters: jest.fn(),
  disbandUnderpopulatedStories: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

// Mock global fetch for Gemini
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

let organizeStoryAngles: typeof import('./organizeStoryAngles').organizeStoryAngles;
let buildNeighborhoods: typeof import('./organizeStoryAngles').buildNeighborhoods;
let computeCentroidEmbedding: typeof import('./organizeStoryAngles').computeCentroidEmbedding;
let findCandidateStoriesForNeighborhood: typeof import('./organizeStoryAngles').findCandidateStoriesForNeighborhood;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = 'mock-gemini-key';
  process.env.SUMMARY_MODEL = 'gemini-flash-latest';
  ({
    organizeStoryAngles,
    buildNeighborhoods,
    computeCentroidEmbedding,
    findCandidateStoriesForNeighborhood,
  } = await import('./organizeStoryAngles'));
});

describe('buildNeighborhoods', () => {
  it('returns empty array when fewer than 2 clusters have embeddings', () => {
    const res = buildNeighborhoods([
      { id: 'c1', createdAt: new Date(), embedding: [1, 0] },
      { id: 'c2', createdAt: new Date(), embedding: null },
    ]);
    expect(res).toEqual([]);
  });

  it('groups clusters with cosine similarity >= threshold and ignores distant clusters', () => {
    const clusters = [
      { id: 'c1', createdAt: new Date(), embedding: [1, 0] },
      { id: 'c2', createdAt: new Date(), embedding: [1, 0] },
      { id: 'c3', createdAt: new Date(), embedding: [0, 1] },
    ];

    const neighborhoods = buildNeighborhoods(clusters, 0.78);
    expect(neighborhoods).toHaveLength(1);
    expect(neighborhoods[0].map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('computeCentroidEmbedding', () => {
  it('computes mean vector across cluster embeddings', () => {
    const clusters = [
      { id: 'c1', createdAt: new Date(), embedding: [1, 0] },
      { id: 'c2', createdAt: new Date(), embedding: [0.5, 0.5] },
    ];
    const centroid = computeCentroidEmbedding(clusters);
    expect(centroid).toEqual([0.75, 0.25]);
  });

  it('returns null if no clusters have embeddings', () => {
    expect(computeCentroidEmbedding([])).toBeNull();
  });
});

describe('findCandidateStoriesForNeighborhood', () => {
  it('matches existing stories by storyId on cluster or by vector similarity', () => {
    const neighborhood = [
      { id: 'c1', createdAt: new Date(), storyId: 's-existing', embedding: [1, 0] },
      { id: 'c2', createdAt: new Date(), storyId: null, embedding: [0, 1] },
    ];

    const existingStories = [
      { id: 's-existing', title: 'Story by ID', status: 'developing', overview: 'O1' },
      { id: 's-vector', title: 'Story by Vector', status: 'dormant', overview: 'O2', embedding: [0, 1] },
      { id: 's-unrelated', title: 'Unrelated', status: 'dormant', overview: 'O3', embedding: [-1, 0] },
    ];

    const candidates = findCandidateStoriesForNeighborhood(neighborhood, existingStories);

    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.id)).toContain('s-existing');
    expect(candidates.map((c) => c.id)).toContain('s-vector');
  });
});

describe('organizeStoryAngles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (mockDb.getStoriesForMatching as jest.Mock).mockResolvedValue([]);
    (mockDb.markDormantStories as jest.Mock).mockResolvedValue(0);
    (mockDb.getStoryArticlesForRealignment as jest.Mock).mockResolvedValue([]);
    (mockDb.realignStoryArticles as jest.Mock).mockResolvedValue({ updatedCount: 0, affectedClusters: [] });
    (mockDb.dissociateClusters as jest.Mock).mockResolvedValue({ count: 0 });
    (mockDb.disbandUnderpopulatedStories as jest.Mock).mockResolvedValue({
      disbandedStoriesCount: 0,
      dissociatedClustersCount: 0,
    });
  });

  it('skips processing if fewer than 2 active clusters are found', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Lone Cluster', summary: 'Summary', embedding: [1, 0], createdAt: new Date() },
    ]);

    await organizeStoryAngles();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
    expect(mockDb.mergeClusters).not.toHaveBeenCalled();
  });

  it('skips LLM calls if no candidate neighborhoods meet similarity threshold and runs dormancy sweep', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Cluster 1', summary: 'S1', embedding: [1, 0], createdAt: new Date() },
      { id: 'c2', headline: 'Cluster 2', summary: 'S2', embedding: [0, 1], createdAt: new Date() },
    ]);

    await organizeStoryAngles();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
    expect(mockDb.mergeClusters).not.toHaveBeenCalled();
    expect(mockDb.markDormantStories).toHaveBeenCalledWith(7);
  });

  it('evaluates candidate neighborhood, executes merges, and reactivates existing/dormant story', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Botched execution attempt', summary: 'S1', embedding: [1, 0], createdAt: new Date() },
      { id: 'c2', headline: 'Botched execution wire duplicate', summary: 'S2', embedding: [1, 0], createdAt: new Date() },
      { id: 'c3', headline: 'Inmate wakes up in hospital', summary: 'S3', embedding: [1, 0], createdAt: new Date() },
    ]);

    (mockDb.getStoriesForMatching as jest.Mock).mockResolvedValue([
      { id: 'dormant-story-1', title: 'Botched Execution', status: 'dormant', overview: 'Old overview', embedding: [1, 0] },
    ]);

    const mockLlmResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  merges: [
                    { targetClusterId: 'c1', sourceClusterIds: ['c2'] },
                  ],
                  story: {
                    existingStoryId: 'dormant-story-1',
                    storyTitle: 'Christa Pike Execution Attempt and Aftermath',
                    status: 'developing',
                    overview: 'Macro overview of the event.',
                    angles: [
                      { clusterId: 'c1', angle: 'Botched Execution Attempt' },
                      { clusterId: 'c2', angle: 'Duplicate' },
                      { clusterId: 'c3', angle: 'Hospital Awakening' },
                    ],
                  },
                }),
              },
            ],
          },
        },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockLlmResponse,
    });

    (mockDb.mergeClusters as jest.Mock).mockResolvedValue(2);
    (mockDb.syncStoryWithAngles as jest.Mock).mockResolvedValue({ id: 'dormant-story-1' });

    await organizeStoryAngles();

    // 1. mergeClusters called with target c1 and source [c2]
    expect(mockDb.mergeClusters).toHaveBeenCalledWith('c1', ['c2']);

    // 2. syncStoryWithAngles called with existingStoryId to reactivate the story
    expect(mockDb.syncStoryWithAngles).toHaveBeenCalledWith({
      existingStoryId: 'dormant-story-1',
      storyTitle: 'Christa Pike Execution Attempt and Aftermath',
      status: 'developing',
      overview: 'Macro overview of the event.',
      embedding: [1, 0],
      angles: [
        { clusterId: 'c1', angle: 'Botched Execution Attempt' },
        { clusterId: 'c3', angle: 'Hospital Awakening' },
      ],
    });

    // 3. markDormantStories called
    expect(mockDb.markDormantStories).toHaveBeenCalledWith(7);
  });

  it('handles duplicate merges with null story', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Norfolk GP attack', summary: 'S1', embedding: [1, 0], createdAt: new Date() },
      { id: 'c2', headline: 'Norfolk surgery stabbing', summary: 'S2', embedding: [1, 0], createdAt: new Date() },
    ]);

    const mockLlmResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  merges: [
                    { targetClusterId: 'c1', sourceClusterIds: ['c2'] },
                  ],
                  story: null,
                }),
              },
            ],
          },
        },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockLlmResponse,
    });

    (mockDb.mergeClusters as jest.Mock).mockResolvedValue(1);

    await organizeStoryAngles();

    expect(mockDb.mergeClusters).toHaveBeenCalledWith('c1', ['c2']);
    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
    expect(mockDb.markDormantStories).toHaveBeenCalledWith(7);
  });

  it('realigns misclassified articles across story angles when LLM returns updated assignments', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Corrections Chief Resigns', summary: 'Resignation', embedding: [1, 0], createdAt: new Date() },
      { id: 'c2', headline: 'Inmate Hospitalized', summary: 'Recovery in ICU', embedding: [1, 0], createdAt: new Date() },
    ]);

    const mockEvaluationResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  merges: [],
                  story: {
                    storyTitle: 'Christa Pike Aftermath',
                    status: 'developing',
                    overview: 'Botched execution saga',
                    angles: [
                      { clusterId: 'c1', angle: 'Chief Resignation' },
                      { clusterId: 'c2', angle: 'Hospital Recovery' },
                    ],
                  },
                }),
              },
            ],
          },
        },
      ],
    };

    const mockRealignmentResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  assignments: [
                    { articleId: 'art-1', targetClusterId: 'c1' },
                    { articleId: 'art-2', targetClusterId: 'c2' }, // misclassified article moved from c1 to c2
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockEvaluationResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRealignmentResponse,
      });

    (mockDb.syncStoryWithAngles as jest.Mock).mockResolvedValue({ id: 'story-1' });
    (mockDb.getStoryArticlesForRealignment as jest.Mock).mockResolvedValue([
      { articleId: 'art-1', currentClusterId: 'c1', title: 'Chief steps down' },
      { articleId: 'art-2', currentClusterId: 'c1', title: 'Pike on ventilator in ICU' },
    ]);
    (mockDb.realignStoryArticles as jest.Mock).mockResolvedValue({
      updatedCount: 1,
      affectedClusters: ['c1', 'c2'],
    });

    await organizeStoryAngles();

    expect(mockDb.getStoryArticlesForRealignment).toHaveBeenCalledWith(['c1', 'c2']);
    expect(mockDb.realignStoryArticles).toHaveBeenCalledWith([
      { articleId: 'art-2', targetClusterId: 'c2' },
    ]);
  });

  it('dissociates clusters when candidate clusters previously in a story are evaluated as standalone', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      {
        id: 'c-badenoch-scrutiny',
        headline: 'Kemi Badenoch Faces Scrutiny Ahead of Conservative Party Conference',
        summary: 'General party conference profile',
        embedding: [1, 0],
        createdAt: new Date(),
        storyId: 'story-badenoch-general',
      },
      {
        id: 'c-badenoch-tax',
        headline: 'Badenoch Pledges to Scrap Inheritance Tax on Family Homes at Tory Conference',
        summary: 'Specific policy proposal',
        embedding: [1, 0],
        createdAt: new Date(),
        storyId: 'story-badenoch-general',
      },
    ]);

    const mockStandaloneEvaluationResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  merges: [],
                  stories: [],
                }),
              },
            ],
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockStandaloneEvaluationResponse,
    });

    (mockDb.dissociateClusters as jest.Mock).mockResolvedValue({ count: 2 });
    (mockDb.disbandUnderpopulatedStories as jest.Mock).mockResolvedValue({
      disbandedStoriesCount: 1,
      dissociatedClustersCount: 0,
    });

    await organizeStoryAngles();

    // Both clusters should be dissociated since they had storyIds but were not included in any story angles
    expect(mockDb.dissociateClusters).toHaveBeenCalledWith([
      'c-badenoch-scrutiny',
      'c-badenoch-tax',
    ]);
    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
    expect(mockDb.disbandUnderpopulatedStories).toHaveBeenCalled();
  });
});
