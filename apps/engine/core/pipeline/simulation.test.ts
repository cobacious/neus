import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the snapshot fixture if present
const fixturePath = path.resolve(__dirname, '../../fixtures/production-cluster-topology.json');
const hasFixture = fs.existsSync(fixturePath);

const describeWithFixture = hasFixture ? describe : describe.skip;

describeWithFixture('Pipeline Offline Simulation (Real Production Topology)', () => {
  let mockDb: any;
  let mockFetch: any;
  let organizeStoryAngles: typeof import('./organizeStoryAngles').organizeStoryAngles;
  let isSettledNeighborhood: typeof import('./organizeStoryAngles').isSettledNeighborhood;
  let buildNeighborhoods: typeof import('./organizeStoryAngles').buildNeighborhoods;

  let snapshot: {
    activeClusters: any[];
    stories: any[];
  };

  beforeAll(async () => {
    process.env.GEMINI_API_KEY = 'mock-key';
    process.env.SUMMARY_MODEL = 'gemini-flash-latest';
    process.env.ORGANIZE_TIME_BUDGET_MS = '60000'; // 60s for full mock run

    snapshot = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    mockDb = {
      getActiveClustersForStories: jest.fn().mockImplementation(async () => snapshot.activeClusters),
      getStoriesForMatching: jest.fn().mockImplementation(async () => snapshot.stories),
      syncStoryWithAngles: jest.fn().mockImplementation(async () => ({ id: 'mock-synced-story' })),
      mergeClusters: jest.fn().mockResolvedValue(undefined as any),
      markDormantStories: jest.fn().mockResolvedValue(0 as any),
      getStoryArticlesForRealignment: jest.fn().mockResolvedValue([] as any),
      realignStoryArticles: jest.fn().mockResolvedValue({ updatedCount: 0, affectedClusters: [] } as any),
      dissociateClusters: jest.fn().mockResolvedValue(undefined as any),
      disbandUnderpopulatedStories: jest.fn().mockResolvedValue({ disbandedStoriesCount: 0, dissociatedClustersCount: 0 } as any),
    };

    jest.unstable_mockModule('@neus/db', () => mockDb);

    mockFetch = jest.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
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
      }),
    }));
    global.fetch = mockFetch as any;

    ({
      organizeStoryAngles,
      isSettledNeighborhood,
      buildNeighborhoods,
    } = await import('./organizeStoryAngles'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds expected candidate neighborhoods from the production snapshot', () => {
    const neighborhoods = buildNeighborhoods(snapshot.activeClusters, 0.78);
    expect(neighborhoods.length).toBeGreaterThanOrEqual(60);
  });

  it('correctly identifies settled stories and skips redundant LLM calls', async () => {
    const startTime = Date.now();
    await organizeStoryAngles();
    const durationMs = Date.now() - startTime;

    // The simulation with mocked AI must execute very fast (< 3 seconds)
    expect(durationMs).toBeLessThan(3000);

    // Verify that getActiveClustersForStories and getStoriesForMatching were called
    expect(mockDb.getActiveClustersForStories).toHaveBeenCalledWith(30);
    expect(mockDb.getStoriesForMatching).toHaveBeenCalled();

    // Verify that LLM calls were made ONLY for unsettled/new neighborhoods, not the 26 settled ones
    // With 64 neighborhoods and 26 settled + 17 inactive skipped:
    // mockFetch should be called at most 25 times (for the ~21 unsettled neighborhoods)
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(25);
  });
});
