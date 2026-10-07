import { jest } from '@jest/globals';

const mockPrisma = {
  article: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let syncArticles: typeof import('./syncArticles').syncArticles;
let hasArticleChanged: typeof import('./syncArticles').hasArticleChanged;

beforeAll(async () => {
  ({ syncArticles, hasArticleChanged } = await import('./syncArticles'));
});

describe('hasArticleChanged', () => {
  const existing = {
    title: 'Original Title',
    snippet: 'Original Snippet',
    author: 'Author A',
    categories: 'tech,ai',
    updatedAt: new Date('2026-10-01T10:00:00Z'),
    publishedAt: new Date('2026-10-01T09:00:00Z'),
  };

  it('returns false when incoming fields match existing', () => {
    const incoming = {
      url: 'https://example.com/1',
      title: 'Original Title',
      source: 'Source',
      sourceId: 's1',
      publishedAt: new Date('2026-10-01T09:00:00Z'),
      snippet: 'Original Snippet',
      author: 'Author A',
      categories: 'tech,ai',
      updatedAt: new Date('2026-10-01T10:00:00Z'),
    };
    expect(hasArticleChanged(existing, incoming)).toBe(false);
  });

  it('returns true when title changed', () => {
    const incoming = {
      url: 'https://example.com/1',
      title: 'New Updated Title',
      source: 'Source',
      sourceId: 's1',
      publishedAt: new Date('2026-10-01T09:00:00Z'),
    };
    expect(hasArticleChanged(existing, incoming)).toBe(true);
  });

  it('returns true when snippet changed', () => {
    const incoming = {
      url: 'https://example.com/1',
      title: 'Original Title',
      source: 'Source',
      sourceId: 's1',
      publishedAt: new Date('2026-10-01T09:00:00Z'),
      snippet: 'New Different Snippet',
    };
    expect(hasArticleChanged(existing, incoming)).toBe(true);
  });

  it('returns true when updatedAt is newer', () => {
    const incoming = {
      url: 'https://example.com/1',
      title: 'Original Title',
      source: 'Source',
      sourceId: 's1',
      publishedAt: new Date('2026-10-01T09:00:00Z'),
      updatedAt: new Date('2026-10-01T12:00:00Z'),
    };
    expect(hasArticleChanged(existing, incoming)).toBe(true);
  });
});

describe('syncArticles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('separates articles into created, updated, and unchanged buckets', async () => {
    // Existing article in DB
    (mockPrisma.article.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'a1',
        url: 'https://example.com/existing-unchanged',
        title: 'Unchanged Story',
        snippet: 'Same Snippet',
        author: 'Writer',
        categories: 'news',
        updatedAt: new Date('2026-10-01T10:00:00Z'),
        publishedAt: new Date('2026-10-01T09:00:00Z'),
      },
      {
        id: 'a2',
        url: 'https://example.com/existing-modified',
        title: 'Old Title',
        snippet: 'Snippet',
        author: null,
        categories: null,
        updatedAt: null,
        publishedAt: new Date('2026-10-01T09:00:00Z'),
      },
    ] as any);

    (mockPrisma.article.createMany as jest.Mock).mockResolvedValue({ count: 1 } as any);
    (mockPrisma.article.update as jest.Mock).mockResolvedValue({} as any);

    const result = await syncArticles([
      {
        url: 'https://example.com/existing-unchanged',
        title: 'Unchanged Story',
        source: 'BBC',
        sourceId: 's1',
        snippet: 'Same Snippet',
        author: 'Writer',
        categories: 'news',
        publishedAt: new Date('2026-10-01T09:00:00Z'),
        updatedAt: new Date('2026-10-01T10:00:00Z'),
      },
      {
        url: 'https://example.com/existing-modified',
        title: 'Brand New Headline Edit',
        source: 'Reuters',
        sourceId: 's2',
        publishedAt: new Date('2026-10-01T09:00:00Z'),
      },
      {
        url: 'https://example.com/brand-new',
        title: 'Brand New Article',
        source: 'AP',
        sourceId: 's3',
        publishedAt: new Date('2026-10-02T09:00:00Z'),
      },
    ]);

    expect(result).toEqual({
      created: 1,
      updated: 1,
      unchanged: 1,
    });

    expect(mockPrisma.article.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.article.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ url: 'https://example.com/brand-new' }),
      ]),
      skipDuplicates: true,
    });

    expect(mockPrisma.article.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.article.update).toHaveBeenCalledWith({
      where: { url: 'https://example.com/existing-modified' },
      data: expect.objectContaining({ title: 'Brand New Headline Edit' }),
    });
  });

  it('deduplicates incoming articles with duplicate URLs', async () => {
    (mockPrisma.article.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.article.createMany as jest.Mock).mockResolvedValue({ count: 1 } as any);

    const result = await syncArticles([
      {
        url: 'https://example.com/dup',
        title: 'First Version',
        source: 'Feed 1',
        sourceId: 's1',
        publishedAt: new Date(),
      },
      {
        url: 'https://example.com/dup',
        title: 'Second Version',
        source: 'Feed 2',
        sourceId: 's2',
        publishedAt: new Date(),
      },
    ]);

    expect(result.created).toBe(1);
    expect(mockPrisma.article.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ url: 'https://example.com/dup', title: 'Second Version' })],
      skipDuplicates: true,
    });
  });
});
