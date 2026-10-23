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
let isSettledNeighborhood: typeof import('./organizeStoryAngles').isSettledNeighborhood;
let classifyArticleAngles: typeof import('./organizeStoryAngles').classifyArticleAngles;
let synthesizeStoryCopy: typeof import('./organizeStoryAngles').synthesizeStoryCopy;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = 'mock-gemini-key';
  process.env.SUMMARY_MODEL = 'gemini-flash-latest';
  ({
    organizeStoryAngles,
    buildNeighborhoods,
    computeCentroidEmbedding,
    findCandidateStoriesForNeighborhood,
    isSettledNeighborhood,
    classifyArticleAngles,
    synthesizeStoryCopy,
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
    delete process.env.TYPESAFE_API_KEY;
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
                  storyTitle: 'Christa Pike Execution Attempt and Aftermath',
                  status: 'developing',
                  overview: 'Macro overview of the event.',
                  angles: [
                    { clusterId: 'c1', angle: 'Botched Execution Attempt' },
                    { clusterId: 'c3', angle: 'Hospital Awakening' },
                  ],
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

    await organizeStoryAngles(
      {},
      {
        detectDuplicateClusters: async () => [{ targetClusterId: 'c1', sourceClusterIds: ['c2'] }],
        detectStorySagas: async () => [
          {
            existingStoryId: 'dormant-story-1',
            clusterIds: ['c1', 'c3'],
          },
        ],
      }
    );

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

  it('handles duplicate merges and skips story when only 1 cluster remains', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Norfolk GP attack', summary: 'S1', embedding: [1, 0], createdAt: new Date() },
      { id: 'c2', headline: 'Norfolk surgery stabbing', summary: 'S2', embedding: [1, 0], createdAt: new Date() },
    ]);

    (mockDb.mergeClusters as jest.Mock).mockResolvedValue(1);

    await organizeStoryAngles(
      {},
      {
        detectDuplicateClusters: async () => [{ targetClusterId: 'c1', sourceClusterIds: ['c2'] }],
      }
    );

    expect(mockDb.mergeClusters).toHaveBeenCalledWith('c1', ['c2']);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
    expect(mockDb.markDormantStories).toHaveBeenCalledWith(7);
  });

  it('merges duplicate clusters via detector and skips story evaluation when only 1 cluster remains', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        headline: 'Fatal tiger incident at Doncaster park',
        summary: 'S1',
        embedding: [0.95, 0.05],
        createdAt: new Date(),
        _count: { articleAssignments: 4 },
      },
      {
        id: 'c2',
        headline: 'Keeper dies in tiger enclosure attack',
        summary: 'S2',
        embedding: [0.94, 0.06],
        createdAt: new Date(),
        _count: { articleAssignments: 2 },
      },
    ]);

    const mockDetectDuplicates = jest.fn().mockResolvedValue([
      { targetClusterId: 'c1', sourceClusterIds: ['c2'] },
    ]);

    await organizeStoryAngles({}, { detectDuplicateClusters: mockDetectDuplicates as any });

    // c2 should be merged into c1
    expect(mockDb.mergeClusters).toHaveBeenCalledWith('c1', ['c2']);

    // Since only 1 cluster remains, story sync should not be called
    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
  });

  it('realigns misclassified articles across story angles when updated assignments occur', async () => {
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
                  storyTitle: 'Christa Pike Aftermath',
                  status: 'developing',
                  overview: 'Botched execution saga',
                  angles: [
                    { clusterId: 'c1', angle: 'Chief Resignation' },
                    { clusterId: 'c2', angle: 'Hospital Recovery' },
                  ],
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
      json: async () => mockEvaluationResponse,
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

    await organizeStoryAngles(
      {},
      {
        detectStorySagas: async () => [
          {
            existingStoryId: null,
            clusterIds: ['c1', 'c2'],
          },
        ],
        classifyArticleAngles: async () => [
          { articleId: 'art-1', targetClusterId: 'c1' },
          { articleId: 'art-2', targetClusterId: 'c2' },
        ],
      }
    );

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

  it('defers evaluations and still runs the dormancy sweep when the time budget is spent', async () => {
    process.env.ORGANIZE_TIME_BUDGET_MS = '0';
    try {
      (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
        { id: 'c1', headline: 'A', summary: 'S1', embedding: [1, 0], createdAt: new Date() },
        { id: 'c2', headline: 'B', summary: 'S2', embedding: [1, 0], createdAt: new Date() },
      ]);

      await organizeStoryAngles();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
      expect(mockDb.mergeClusters).not.toHaveBeenCalled();
      expect(mockDb.markDormantStories).toHaveBeenCalledWith(7);
    } finally {
      delete process.env.ORGANIZE_TIME_BUDGET_MS;
    }
  });

  it('evaluates the freshest neighborhood first', async () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'old1', headline: 'Older headline one', summary: 'S', embedding: [1, 0], createdAt: thirtyHoursAgo },
      { id: 'old2', headline: 'Older headline two', summary: 'S', embedding: [1, 0], createdAt: thirtyHoursAgo },
      { id: 'new1', headline: 'Fresh headline one', summary: 'S', embedding: [0, 1], createdAt: new Date() },
      { id: 'new2', headline: 'Fresh headline two', summary: 'S', embedding: [0, 1], createdAt: new Date() },
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    storyTitle: 'Test Story',
                    status: 'developing',
                    overview: 'Test overview',
                    angles: [
                      { clusterId: 'c1', angle: 'Angle 1' },
                      { clusterId: 'c2', angle: 'Angle 2' },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    await organizeStoryAngles(
      {},
      {
        detectStorySagas: async (clusters) => [
          {
            existingStoryId: null,
            clusterIds: clusters.map((c) => c.id),
          },
        ],
      }
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const firstBody = (mockFetch.mock.calls[0] as [string, any])[1].body as string;
    expect(firstBody).toContain('Fresh headline one');
    expect(firstBody).not.toContain('Older headline one');
  });

  it('skips settled neighborhoods without invoking LLM or mutating database', async () => {
    const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000); // 3 days ago

    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        headline: 'Historic Angle 1',
        summary: 'Summary 1',
        embedding: [1, 0],
        createdAt: oldDate,
        storyId: 'story-settled',
        storyAngle: 'Angle One',
        articleAssignments: [{ createdAt: oldDate }],
      },
      {
        id: 'c2',
        headline: 'Historic Angle 2',
        summary: 'Summary 2',
        embedding: [1, 0],
        createdAt: oldDate,
        storyId: 'story-settled',
        storyAngle: 'Angle Two',
        articleAssignments: [{ createdAt: oldDate }],
      },
    ]);

    (mockDb.getStoriesForMatching as jest.Mock).mockResolvedValue([
      {
        id: 'story-settled',
        title: 'Settled Historic Story',
        status: 'developing',
        overview: 'Overview',
        _count: { clusters: 2 },
      },
    ]);

    await organizeStoryAngles();

    // LLM must NOT be called for settled stories
    expect(mockFetch).not.toHaveBeenCalled();
    // syncStoryWithAngles must NOT be called (preserving updatedAt)
    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
    // No clusters merged
    expect(mockDb.mergeClusters).not.toHaveBeenCalled();
    // Realignment not invoked
    expect(mockDb.realignStoryArticles).not.toHaveBeenCalled();
  });
});

describe('isSettledNeighborhood', () => {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const recentDate = new Date();

  const stories = [
    {
      id: 's1',
      title: 'Story 1',
      status: 'developing',
      overview: 'Overview 1',
      _count: { clusters: 2 },
    },
  ];

  it('returns true when all clusters belong to same story, have angles, and are older than cutoff', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'A1', createdAt: oldDate, articleAssignments: [{ createdAt: oldDate }] },
      { id: 'c2', storyId: 's1', storyAngle: 'A2', createdAt: oldDate, articleAssignments: [{ createdAt: oldDate }] },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(true);
    expect(res.storyTitle).toBe('Story 1');
  });

  it('returns false when any cluster lacks storyId', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'A1', createdAt: oldDate },
      { id: 'c2', storyId: null, storyAngle: null, createdAt: oldDate },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when clusters belong to different stories', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'A1', createdAt: oldDate },
      { id: 'c2', storyId: 's2', storyAngle: 'A2', createdAt: oldDate },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when any cluster is missing storyAngle', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'A1', createdAt: oldDate },
      { id: 'c2', storyId: 's1', storyAngle: null, createdAt: oldDate },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when a cluster was created recently', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'A1', createdAt: oldDate },
      { id: 'c2', storyId: 's1', storyAngle: 'A2', createdAt: recentDate },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when a cluster received a new article assignment recently', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'A1', createdAt: oldDate, articleAssignments: [{ createdAt: oldDate }] },
      { id: 'c2', storyId: 's1', storyAngle: 'A2', createdAt: oldDate, articleAssignments: [{ createdAt: recentDate }] },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when the story has more clusters in the DB than in this neighborhood', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'A1', createdAt: oldDate, articleAssignments: [{ createdAt: oldDate }] },
    ];
    // DB story has 2 clusters, but neighborhood only has 1
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('treats neighborhood as settled when activeStoryClusterCounts matches neighborhood, ignoring older DB clusters', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'A1', createdAt: oldDate, articleAssignments: [{ createdAt: oldDate }] },
      { id: 'c2', storyId: 's1', storyAngle: 'A2', createdAt: oldDate, articleAssignments: [{ createdAt: oldDate }] },
    ];
    // DB story has 15 historical clusters, but active window only has 2
    const storiesWithManyDbClusters = [
      { id: 's1', title: 'Story 1', status: 'developing', overview: 'Overview', _count: { clusters: 15 } },
    ];
    const activeMap = new Map<string, number>([['s1', 2]]);
    const res = isSettledNeighborhood(neighborhood, storiesWithManyDbClusters, cutoff, activeMap);
    expect(res.settled).toBe(true);
    expect(res.storyTitle).toBe('Story 1');
  });

  it('returns false when activeStoryClusterCounts shows more active clusters outside the neighborhood', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'A1', createdAt: oldDate, articleAssignments: [{ createdAt: oldDate }] },
      { id: 'c2', storyId: 's1', storyAngle: 'A2', createdAt: oldDate, articleAssignments: [{ createdAt: oldDate }] },
    ];
    const activeMap = new Map<string, number>([['s1', 3]]);
    const res = isSettledNeighborhood(neighborhood, stories, cutoff, activeMap);
    expect(res.settled).toBe(false);
  });
});

describe('classifyArticleAngles', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    delete process.env.TYPESAFE_API_KEY;
  });

  const angles = [
    { clusterId: 'c1', angle: 'Legal Proceedings', headline: 'Trial begins', embedding: [1, 0, 0] },
    { clusterId: 'c2', angle: 'Political Fallout', headline: 'Ministers respond', embedding: [0, 1, 0] },
  ];

  it('resolves confident articles via vector cosine similarity without making LLM calls', async () => {
    const articles = [
      { articleId: 'a1', currentClusterId: 'c1', title: 'Court hearing day one', embedding: [0.99, 0.05, 0] },
      { articleId: 'a2', currentClusterId: 'c1', title: 'PM faces questions in parliament', embedding: [0.05, 0.99, 0] }, // misclassified into c1, clearly c2
    ];

    const assignments = await classifyArticleAngles('Major Political Trial', angles, articles);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(assignments).toEqual([
      { articleId: 'a1', targetClusterId: 'c1' },
      { articleId: 'a2', targetClusterId: 'c2' },
    ]);
  });

  it('defers ambiguous articles to batch classifier while resolving confident ones locally', async () => {
    const articles = [
      { articleId: 'a1', currentClusterId: 'c1', title: 'Court hearing day one', embedding: [0.99, 0.05, 0] }, // clear match for c1
      { articleId: 'a2', currentClusterId: 'c1', title: 'Ambiguous reaction piece', embedding: [0.6, 0.58, 0] }, // ambiguous margin < 0.04
    ];

    const mockClassifyBatch = jest.fn().mockResolvedValue([
      { articleId: 'a2', targetClusterId: 'c2', confidence: 0.9, choice: 'angle_c2' },
    ]);

    const assignments = await classifyArticleAngles(
      'Major Political Trial',
      angles,
      articles,
      undefined,
      { classifyBatch: mockClassifyBatch as any }
    );

    expect(mockClassifyBatch).toHaveBeenCalledTimes(1);
    expect(assignments).toEqual([
      { articleId: 'a1', targetClusterId: 'c1' },
      { articleId: 'a2', targetClusterId: 'c2' },
    ]);
  });

  it('preserves established articles in existing stories without API calls', async () => {
    const articles = [
      { articleId: 'a-old', currentClusterId: 'c1', title: 'Historic piece', embedding: null },
      { articleId: 'a-new', currentClusterId: 'c-incoming', title: 'New development', embedding: [0.05, 0.98, 0] },
    ];

    const extendedAngles = [
      ...angles,
      { clusterId: 'c-incoming', angle: 'Public Opinion', headline: 'Voters react', embedding: [0, 0, 1] },
    ];

    const assignments = await classifyArticleAngles('Major Political Trial', extendedAngles, articles, {
      isExistingStory: true,
      newClusterIds: new Set(['c-incoming']),
    });

    // No API call needed: a-old is preserved incrementally; a-new is resolved via vector similarity
    expect(mockFetch).not.toHaveBeenCalled();
    expect(assignments).toEqual([
      { articleId: 'a-old', targetClusterId: 'c1' },
      { articleId: 'a-new', targetClusterId: 'c2' },
    ]);
  });

  it('respects none_of_the_above and leaves unrelated articles untouched', async () => {
    const testArticles = [
      { articleId: 'a-matching', currentClusterId: 'c1', title: 'Police investigate trial', embedding: null },
      { articleId: 'a-unrelated', currentClusterId: 'c1', title: 'Unrelated bank interest rates', embedding: null },
    ];

    const mockClassifyBatch = jest.fn().mockResolvedValue([
      { articleId: 'a-matching', targetClusterId: 'c2', confidence: 0.95, choice: 'angle_c2' },
      { articleId: 'a-unrelated', targetClusterId: null, confidence: 0.99, choice: 'none_of_the_above' },
    ]);

    const assignments = await classifyArticleAngles(
      'Major Political Trial',
      angles,
      testArticles,
      undefined,
      { classifyBatch: mockClassifyBatch as any }
    );

    // Only a-matching should be reassigned to c2; a-unrelated should not be in the reassignment list
    expect(assignments).toEqual([
      { articleId: 'a-matching', targetClusterId: 'c2' },
    ]);
  });
});

describe('synthesizeStoryCopy', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('generates structured story copy from confirmed clusters without judging taxonomy', async () => {
    const clusters = [
      { id: 'c1', headline: 'Botched execution attempt', summary: 'S1', date: '2026-10-20', articleCount: 3 },
      { id: 'c2', headline: 'Inmate wakes up in hospital', summary: 'S2', date: '2026-10-21', articleCount: 2 },
    ];

    const mockApiResponse = {
      storyTitle: 'Christa Pike Survives Execution Attempt in Hospital ICU',
      status: 'developing',
      overview: 'Pike remains in critical condition following an execution attempt. Officials have launched an investigation.',
      angles: [
        { clusterId: 'c1', angle: 'Execution Attempt' },
        { clusterId: 'c2', angle: 'Hospital Revival' },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockApiResponse) }],
            },
          },
        ],
      }),
    });

    const result = await synthesizeStoryCopy(clusters);

    expect(result).toEqual(mockApiResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callBody = JSON.parse((mockFetch.mock.calls[0] as [string, any])[1].body);
    const userPrompt = callBody.contents[0].parts[0].text;
    expect(userPrompt).toContain('You are an expert news copywriter and editor.');
    expect(userPrompt).toContain('confirmed as distinct member angles');
    expect(userPrompt).not.toContain('Do 2 or more distinct clusters represent DIFFERENT ANGLES');
  });

  it('includes pre-existing story context when updating an existing story umbrella', async () => {
    const clusters = [
      { id: 'c1', headline: 'Party conference opens', summary: 'Day 1', date: '2026-10-20' },
      { id: 'c2', headline: 'Tax policy announcement', summary: 'Speech', date: '2026-10-21' },
    ];

    const existingStory = {
      id: 'existing-story-id',
      title: 'Conservative Party Conference 2026',
      overview: 'Tory members gather for annual conference in Birmingham.',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    storyTitle: 'Conservative Party Conference 2026 Opens in Birmingham',
                    status: 'developing',
                    overview: 'Tory leadership addresses conference on tax reform.',
                    angles: [
                      { clusterId: 'c1', angle: 'Opening Address' },
                      { clusterId: 'c2', angle: 'Tax Policy' },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const result = await synthesizeStoryCopy(clusters, existingStory);

    expect(result.storyTitle).toBe('Conservative Party Conference 2026 Opens in Birmingham');
    const callBody = JSON.parse((mockFetch.mock.calls[0] as [string, any])[1].body);
    const userPrompt = callBody.contents[0].parts[0].text;
    expect(userPrompt).toContain('PRE-EXISTING STORY IN DATABASE:');
    expect(userPrompt).toContain('Conservative Party Conference 2026');
  });
});


