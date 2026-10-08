import { jest } from '@jest/globals';

const mockDb = {
  getActiveClustersForStories: jest.fn(),
  syncStoryWithAngles: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

// Mock global fetch for Gemini
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

let organizeStoryAngles: typeof import('./organizeStoryAngles').organizeStoryAngles;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = 'mock-gemini-key';
  process.env.SUMMARY_MODEL = 'gemini-flash-latest';
  ({ organizeStoryAngles } = await import('./organizeStoryAngles'));
});

describe('organizeStoryAngles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('skips processing if fewer than 2 active clusters are found', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Lone Cluster', summary: 'Summary' },
    ]);

    await organizeStoryAngles();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
  });

  it('calls Gemini and synchronizes discovered stories and angles', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Botched execution attempt', summary: 'S1', createdAt: new Date() },
      { id: 'c2', headline: 'Inmate wakes up', summary: 'S2', createdAt: new Date() },
      { id: 'c3', headline: 'Stand-alone news', summary: 'S3', createdAt: new Date() },
    ]);

    const mockLlmResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  stories: [
                    {
                      storyTitle: 'Botched Execution Saga',
                      status: 'evolving',
                      overview: 'Overview text here.',
                      angles: [
                        { clusterId: 'c1', angle: 'The Attempt' },
                        { clusterId: 'c2', angle: 'Hospital Recovery' },
                      ],
                    },
                  ],
                  standaloneClusterIds: ['c3'],
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

    (mockDb.syncStoryWithAngles as jest.Mock).mockResolvedValue({ id: 's1' });

    await organizeStoryAngles();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockDb.syncStoryWithAngles).toHaveBeenCalledTimes(1);
    expect(mockDb.syncStoryWithAngles).toHaveBeenCalledWith({
      storyTitle: 'Botched Execution Saga',
      status: 'evolving',
      overview: 'Overview text here.',
      angles: [
        { clusterId: 'c1', angle: 'The Attempt' },
        { clusterId: 'c2', angle: 'Hospital Recovery' },
      ],
    });
  });

  it('ignores stories where fewer than 2 valid clusters exist', async () => {
    (mockDb.getActiveClustersForStories as jest.Mock).mockResolvedValue([
      { id: 'c1', headline: 'Cluster 1', summary: 'S1', createdAt: new Date() },
      { id: 'c2', headline: 'Cluster 2', summary: 'S2', createdAt: new Date() },
    ]);

    const mockLlmResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  stories: [
                    {
                      storyTitle: 'Invalid Single Cluster Story',
                      status: 'developing',
                      overview: 'Overview.',
                      angles: [
                        { clusterId: 'c1', angle: 'Only Angle' },
                        { clusterId: 'non-existent-id', angle: 'Hallucinated' },
                      ],
                    },
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

    await organizeStoryAngles();

    expect(mockDb.syncStoryWithAngles).not.toHaveBeenCalled();
  });
});
