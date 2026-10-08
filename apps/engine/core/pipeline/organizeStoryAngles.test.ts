import { jest } from '@jest/globals';

const mockDb = {
  getActiveClustersForStories: jest.fn(),
  syncStoryWithAngles: jest.fn(),
  mergeClusters: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

// Mock global fetch for Gemini
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

let organizeStoryAngles: typeof import('./organizeStoryAngles').organizeStoryAngles;
let buildNeighborhoods: typeof import('./organizeStoryAngles').buildNeighborhoods;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = 'mock-gemini-key';
  process.env.SUMMARY_MODEL = 'gemini-flash-latest';
  ({ organizeStoryAngles, buildNeighborhoods } = await import('./organizeStoryAngles'));
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
    // c1 and c2 are identical (sim = 1.0)
    // c3 is orthogonal (sim = 0.0)
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

describe('organizeStoryAngles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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

  it('skips LLM calls if no candidate neighborhoods meet similarity threshold', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Cluster 1', summary: 'S1', embedding: [1, 0], createdAt: new Date() },
      { id: 'c2', headline: 'Cluster 2', summary: 'S2', embedding: [0, 1], createdAt: new Date() },
    ]);

    await organizeStoryAngles();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
    expect(mockDb.mergeClusters).not.toHaveBeenCalled();
  });

  it('evaluates candidate neighborhood, executes merges, and synchronizes multi-angle story', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Botched execution attempt', summary: 'S1', embedding: [1, 0], createdAt: new Date() },
      { id: 'c2', headline: 'Botched execution wire duplicate', summary: 'S2', embedding: [1, 0], createdAt: new Date() },
      { id: 'c3', headline: 'Inmate wakes up in hospital', summary: 'S3', embedding: [1, 0], createdAt: new Date() },
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
                    storyTitle: 'Christa Pike Execution Attempt and Aftermath',
                    status: 'evolving',
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
    (mockDb.syncStoryWithAngles as jest.Mock).mockResolvedValue({ id: 's1' });

    await organizeStoryAngles();

    // 1. mergeClusters called with target c1 and source [c2]
    expect(mockDb.mergeClusters).toHaveBeenCalledWith('c1', ['c2']);

    // 2. syncStoryWithAngles called with c1 and c3 (c2 was filtered out because it was merged into c1)
    expect(mockDb.syncStoryWithAngles).toHaveBeenCalledWith({
      storyTitle: 'Christa Pike Execution Attempt and Aftermath',
      status: 'evolving',
      overview: 'Macro overview of the event.',
      angles: [
        { clusterId: 'c1', angle: 'Botched Execution Attempt' },
        { clusterId: 'c3', angle: 'Hospital Awakening' },
      ],
    });
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
  });
});
