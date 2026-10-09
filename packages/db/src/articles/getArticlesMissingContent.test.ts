import { jest } from '@jest/globals';

const findMany = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    article: {
      findMany,
    },
  },
}));

let getArticlesMissingContent: typeof import('./getArticlesMissingContent').getArticlesMissingContent;

beforeAll(async () => {
  ({ getArticlesMissingContent } = await import('./getArticlesMissingContent'));
});

describe('getArticlesMissingContent', () => {
  const originalEnv = process.env.MAX_CONTENT_EXTRACTION;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MAX_CONTENT_EXTRACTION;
  });

  afterAll(() => {
    process.env.MAX_CONTENT_EXTRACTION = originalEnv;
  });

  it('queries strictly content: null, excludes paywalled sources, and caps at default 30', async () => {
    findMany.mockResolvedValue([]);

    await getArticlesMissingContent();

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0][0] as any;
    expect(query.where.content).toBeNull();
    expect(query.where.sourceRel).toEqual({ paywalled: false });
    expect(query.where.createdAt.gte).toBeInstanceOf(Date);
    expect(query.take).toBe(30);
    expect(query.include.sourceRel).toBeDefined();
  });

  it('respects explicit limit parameter', async () => {
    findMany.mockResolvedValue([]);

    await getArticlesMissingContent(15);

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0][0] as any;
    expect(query.take).toBe(15);
  });

  it('respects MAX_CONTENT_EXTRACTION environment variable', async () => {
    process.env.MAX_CONTENT_EXTRACTION = '50';
    findMany.mockResolvedValue([]);

    await getArticlesMissingContent();

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0][0] as any;
    expect(query.take).toBe(50);
  });

  it('omits take if limit is set to 0 (unlimited)', async () => {
    findMany.mockResolvedValue([]);

    await getArticlesMissingContent(0);

    expect(findMany).toHaveBeenCalledTimes(1);
    const query = findMany.mock.calls[0][0] as any;
    expect(query.take).toBeUndefined();
  });
});
