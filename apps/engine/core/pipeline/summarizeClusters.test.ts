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

let summarizeClusters: typeof import('./summarizeClusters').summarizeClusters;

beforeAll(async () => {
  ({ summarizeClusters } = await import('./summarizeClusters'));
});

describe('summarizeClusters', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls generateStructuredJson and updates cluster summary', async () => {
    (mockDb.getClustersToSummarize as jest.Mock).mockResolvedValue([
      { id: 'c1', articleAssignments: [{ article: { title: 't1', snippet: 's1' } }] },
    ]);
    mockGenerateStructuredJson.mockResolvedValue({
      headline: 'H',
      summary: 'S',
    });

    await summarizeClusters();

    expect(mockGenerateStructuredJson).toHaveBeenCalled();
    expect(mockDb.updateClusterSummary).toHaveBeenCalledWith('c1', 'H', 'S');
  });
});
