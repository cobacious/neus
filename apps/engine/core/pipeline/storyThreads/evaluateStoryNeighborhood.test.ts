import { jest } from '@jest/globals';

const mockGenerateStructuredJson = jest.fn();

jest.unstable_mockModule('../../../lib/aiClient', () => ({
  generateStructuredJson: mockGenerateStructuredJson,
}));

let evaluateStoryNeighborhood: typeof import('./evaluateStoryNeighborhood').evaluateStoryNeighborhood;

beforeAll(async () => {
  ({ evaluateStoryNeighborhood } = await import('./evaluateStoryNeighborhood'));
});

describe('evaluateStoryNeighborhood', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls generateStructuredJson with clusters and candidate stories', async () => {
    const mockResult = {
      merges: [{ targetClusterId: 'c1', sourceClusterIds: ['c2'] }],
      stories: [
        {
          storyTitle: 'Test Story',
          status: 'developing' as const,
          overview: 'Overview of test story.',
          threads: [{ clusterId: 'c1', thread: 'Core Angle' }],
        },
      ],
    };

    (mockGenerateStructuredJson as jest.Mock).mockResolvedValue(mockResult);

    const clusters = [
      { id: 'c1', headline: 'Incident Occurs', summary: 'Summary 1', date: '2026-10-23' },
      { id: 'c2', headline: 'Incident Details', summary: 'Summary 2', date: '2026-10-23' },
    ];

    const candidateStories = [
      { id: 'story-1', title: 'Prior Story', status: 'developing', overview: 'Prior overview' },
    ];

    const result = await evaluateStoryNeighborhood(clusters, candidateStories);

    expect(mockGenerateStructuredJson).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockResult);
  });
});
