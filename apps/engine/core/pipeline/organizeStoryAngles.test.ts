import { jest } from '@jest/globals';

const mockDb = {
  getActiveClustersForStories: jest.fn(),
  syncStoryWithAngles: jest.fn(),
  mergeClusters: jest.fn(),
  getStoriesForMatching: jest.fn(),
  markDormantStories: jest.fn(),
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
});
