import { jest } from '@jest/globals';

const mockGenerateStructuredJson = jest.fn();

jest.unstable_mockModule('../../../lib/aiClient', () => ({
  generateStructuredJson: mockGenerateStructuredJson,
}));

let synthesizeStoryCopy: typeof import('./synthesizeStoryCopy').synthesizeStoryCopy;

beforeAll(async () => {
  ({ synthesizeStoryCopy } = await import('./synthesizeStoryCopy'));
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
      overview: 'Tory members gather for annual conference in Birmingham amid tax debates.',
      threads: [
        { clusterId: 'c1', thread: 'Conference Opening' },
        { clusterId: 'c2', thread: 'Tax Policy Debate' },
      ],
    };

    (mockGenerateStructuredJson as jest.Mock).mockResolvedValueOnce(mockApiResponse);

    const result = await synthesizeStoryCopy(clusters, existingStory);

    expect(result).toEqual(mockApiResponse);
    expect(mockGenerateStructuredJson).toHaveBeenCalledTimes(1);

    const callArgs = (mockGenerateStructuredJson as jest.Mock).mock.calls[0][0] as { prompt: string };
    expect(callArgs.prompt).toContain('PRE-EXISTING STORY IN DATABASE');
    expect(callArgs.prompt).toContain('Conservative Party Conference 2026');
  });
});
