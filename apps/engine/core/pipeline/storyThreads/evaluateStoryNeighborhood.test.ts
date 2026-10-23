import { jest } from '@jest/globals';

const mockGenerateStructuredJson = jest.fn();

jest.unstable_mockModule('../../../lib/aiClient', () => ({
  generateStructuredJson: mockGenerateStructuredJson,
}));

let evaluateStoryNeighborhood: typeof import('./evaluateStoryNeighborhood').evaluateStoryNeighborhood;
let synthesizeStoryCopy: typeof import('./evaluateStoryNeighborhood').synthesizeStoryCopy;

beforeAll(async () => {
  ({ evaluateStoryNeighborhood, synthesizeStoryCopy } = await import('./evaluateStoryNeighborhood'));
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

describe('synthesizeStoryCopy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('generates structured story copy from confirmed clusters without judging taxonomy', async () => {
    const clusters = [
      { id: 'c1', headline: 'Botched execution attempt', summary: 'S1', date: '2026-10-20', articleCount: 3 },
      { id: 'c2', headline: 'Inmate wakes up in hospital', summary: 'S2', date: '2026-10-21', articleCount: 2 },
    ];

    const mockApiResponse = {
      storyTitle: 'Christa Pike Survives Execution Attempt in Hospital ICU',
      status: 'developing' as const,
      overview: 'Pike remains in critical condition following an execution attempt. Officials have launched an investigation.',
      threads: [
        { clusterId: 'c1', thread: 'Execution Attempt' },
        { clusterId: 'c2', thread: 'Hospital Revival' },
      ],
    };

    (mockGenerateStructuredJson as jest.Mock).mockResolvedValueOnce(mockApiResponse);

    const result = await synthesizeStoryCopy(clusters);

    expect(result).toEqual(mockApiResponse);
    expect(mockGenerateStructuredJson).toHaveBeenCalledTimes(1);

    const callArgs = (mockGenerateStructuredJson as jest.Mock).mock.calls[0][0] as { prompt: string };
    expect(callArgs.prompt).toContain('You are an expert news copywriter and editor.');
    expect(callArgs.prompt).toContain('confirmed as distinct member threads');
    expect(callArgs.prompt).not.toContain('Do 2 or more distinct clusters represent DIFFERENT REPORTING THREADS');
  });

  it('includes pre-existing story context when updating an existing story umbrella', async () => {
    const clusters = [
      { id: 'c1', headline: 'Party conference opens', summary: 'Day 1', date: '2026-10-20' },
      { id: 'c2', headline: 'Tax policy announcement', summary: 'Speech', date: '2026-10-21' },
    ];

    const existingStory = {
      id: 'existing-story-id',
      title: 'Conservative Party Conference 2026',
      status: 'developing' as const,
      overview: 'Tory members gather for annual conference in Birmingham.',
    };

    const mockApiResponse = {
      storyTitle: 'Conservative Party Conference 2026 Opens in Birmingham',
      status: 'developing' as const,
      overview: 'Tory leadership addresses conference on tax reform.',
      threads: [
        { clusterId: 'c1', thread: 'Opening Address' },
        { clusterId: 'c2', thread: 'Tax Policy' },
      ],
    };

    (mockGenerateStructuredJson as jest.Mock).mockResolvedValueOnce(mockApiResponse);

    const result = await synthesizeStoryCopy(clusters, existingStory);

    expect(result.storyTitle).toBe('Conservative Party Conference 2026 Opens in Birmingham');
    const callArgs = (mockGenerateStructuredJson as jest.Mock).mock.calls[0][0] as { prompt: string };
    expect(callArgs.prompt).toContain('PRE-EXISTING STORY IN DATABASE:');
    expect(callArgs.prompt).toContain('Conservative Party Conference 2026');
  });
});
