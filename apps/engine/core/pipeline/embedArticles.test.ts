import { jest } from '@jest/globals';
import OpenAI from 'openai';

const mockDb = {
  getUnembeddedArticles: jest.fn(),
  updateArticleEmbedding: jest.fn(),
};

jest.unstable_mockModule('@neus/db', () => mockDb);

const embeddingsCreateMock = jest.fn();
jest.unstable_mockModule('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    embeddings: { create: embeddingsCreateMock },
  })),
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
    mockDb.getUnembeddedArticles.mockResolvedValue([
      { id: 'a1', content: 'hello', title: 't1' },
      { id: 'a2', content: 'world', title: 't2' },
    ]);
    embeddingsCreateMock.mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });

    await embedNewArticles();

    expect(embeddingsCreateMock).toHaveBeenCalledTimes(2);
    expect(mockDb.updateArticleEmbedding).toHaveBeenCalledTimes(2);
    expect(mockDb.updateArticleEmbedding).toHaveBeenCalledWith('a1', [0.1, 0.2]);
  });
});
