import { jest } from '@jest/globals';

const mockDb = {
  getUnembeddedArticles: jest.fn(),
  updateArticleEmbedding: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

const mockGenerateEmbedding = jest.fn();
jest.unstable_mockModule('../../lib/aiClient', () => ({
  generateEmbedding: mockGenerateEmbedding,
  resolveEmbeddingModel: () => 'mock-embedding-model',
  isGeminiActive: () => true,
}));

let embedNewArticles: typeof import('./embedArticles').embedNewArticles;

beforeAll(async () => {
  ({ embedNewArticles } = await import('./embedArticles'));
});

describe('embedNewArticles', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('embeds articles and stores embeddings', async () => {
    (mockDb.getUnembeddedArticles as jest.Mock).mockResolvedValue([
      { id: 'a1', content: 'hello', title: 't1' },
      { id: 'a2', content: 'world', title: 't2' },
    ]);
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2]);

    await embedNewArticles();

    expect(mockGenerateEmbedding).toHaveBeenCalledTimes(2);
    expect(mockDb.updateArticleEmbedding).toHaveBeenCalledTimes(2);
    expect(mockDb.updateArticleEmbedding).toHaveBeenCalledWith('a1', [0.1, 0.2]);
  });
});
