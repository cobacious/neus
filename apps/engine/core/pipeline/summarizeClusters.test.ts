import { jest } from '@jest/globals';

const mockDb = {
  getClustersToSummarize: jest.fn(),
  updateClusterSummary: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

const mockGenerateStructuredJson = jest.fn();
jest.unstable_mockModule('../../lib/aiClient', () => ({
  generateStructuredJson: mockGenerateStructuredJson,
}));

const mockClassifyClusterTags = jest.fn();
jest.unstable_mockModule('../../lib/typesafeClient', () => ({
  classifyClusterTags: mockClassifyClusterTags,
}));

let summarizeClusters: typeof import('./summarizeClusters').summarizeClusters;

beforeAll(async () => {
  ({ summarizeClusters } = await import('./summarizeClusters'));
});

describe('summarizeClusters', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls generateStructuredJson, classifies tags and updates cluster summary', async () => {
    (mockDb.getClustersToSummarize as jest.Mock).mockResolvedValue([
      { id: 'c1', articleAssignments: [{ article: { title: 't1', snippet: 's1' } }] },
    ]);
    mockGenerateStructuredJson.mockResolvedValue({
      headline: 'H',
      summary: 'S',
    });
    mockClassifyClusterTags.mockResolvedValue(['politics', 'uk']);

    await summarizeClusters();

    expect(mockGenerateStructuredJson).toHaveBeenCalled();
    expect(mockClassifyClusterTags).toHaveBeenCalledWith({
      headline: 'H',
      summary: 'S',
    });
    expect(mockDb.updateClusterSummary).toHaveBeenCalledWith('c1', 'H', 'S', ['politics', 'uk']);
  });
});
