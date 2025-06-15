import { jest } from '@jest/globals';
import OpenAI from 'openai';

const mockDb = {
  getClustersToSummarize: jest.fn(),
  updateClusterSummary: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

const chatCreateMock = jest.fn();
jest.unstable_mockModule('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: chatCreateMock } },
  })),
}));

let summarizeClusters: typeof import('./summarizeClusters').summarizeClusters;

beforeAll(async () => {
  ({ summarizeClusters } = await import('./summarizeClusters'));
});

describe('summarizeClusters', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls OpenAI and updates cluster summary', async () => {
    mockDb.getClustersToSummarize.mockResolvedValue([
      { id: 'c1', articleAssignments: [{ article: { title: 't1', snippet: 's1' } }] },
    ]);
    chatCreateMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ headline: 'H', summary: 'S' }) } }],
      usage: { total_tokens: 5 },
    });

    await summarizeClusters();

    expect(chatCreateMock).toHaveBeenCalled();
    expect(mockDb.updateClusterSummary).toHaveBeenCalledWith('c1', 'H', 'S');
  });
});
