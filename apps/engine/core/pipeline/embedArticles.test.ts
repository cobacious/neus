import { jest } from '@jest/globals';

const mockDb = {
  getUnembeddedArticles: jest.fn(),
  updateArticleEmbedding: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

const mockGenerateEmbedding = jest.fn();
const mockGenerateEmbeddingsBatch = jest.fn();
jest.unstable_mockModule('../../lib/aiClient', () => ({
  generateEmbedding: mockGenerateEmbedding,
  generateEmbeddingsBatch: mockGenerateEmbeddingsBatch,
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

  it('embeds articles in batch and stores embeddings', async () => {
    (mockDb.getUnembeddedArticles as jest.Mock).mockResolvedValue([
      { id: 'a1', content: 'hello', title: 't1' },
      { id: 'a2', content: 'world', title: 't2' },
    ]);
    (mockGenerateEmbeddingsBatch as jest.Mock).mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    await embedNewArticles();

    expect(mockGenerateEmbeddingsBatch).toHaveBeenCalledWith(['hello', 'world']);
    expect(mockDb.updateArticleEmbedding).toHaveBeenCalledTimes(2);
    expect(mockDb.updateArticleEmbedding).toHaveBeenCalledWith('a1', [0.1, 0.2]);
    expect(mockDb.updateArticleEmbedding).toHaveBeenCalledWith('a2', [0.3, 0.4]);
  });

  it('falls back to individual embeddings if batch fails', async () => {
    (mockDb.getUnembeddedArticles as jest.Mock).mockResolvedValue([
      { id: 'a1', content: 'hello', title: 't1' },
    ]);
    (mockGenerateEmbeddingsBatch as jest.Mock).mockRejectedValue(new Error('Batch error'));
    (mockGenerateEmbedding as jest.Mock).mockResolvedValue([0.1, 0.2]);

    await embedNewArticles();

    expect(mockGenerateEmbedding).toHaveBeenCalledWith('hello');
    expect(mockDb.updateArticleEmbedding).toHaveBeenCalledWith('a1', [0.1, 0.2]);
  });
});
