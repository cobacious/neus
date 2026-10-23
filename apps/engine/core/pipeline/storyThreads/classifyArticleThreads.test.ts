import { jest } from '@jest/globals';

let classifyArticleThreads: typeof import('./classifyArticleThreads').classifyArticleThreads;

beforeAll(async () => {
  ({ classifyArticleThreads } = await import('./classifyArticleThreads'));
});

describe('classifyArticleThreads', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns empty array if fewer than 2 threads or no articles', async () => {
    const res1 = await classifyArticleThreads('Title', [], []);
    expect(res1).toEqual([]);

    const res2 = await classifyArticleThreads(
      'Title',
      [{ clusterId: 'c1', thread: 'Thread 1' }],
      [{ articleId: 'a1', currentClusterId: 'c1', title: 'Art 1' }]
    );
    expect(res2).toEqual([]);
  });

  it('resolves articles via vector cosine similarity without LLM calls when confidence is high', async () => {
    const threads = [
      { clusterId: 'c1', thread: 'Hospital Care', embedding: [1, 0, 0] },
      { clusterId: 'c2', thread: 'Court Case', embedding: [0, 1, 0] },
    ];

    const articles = [
      { articleId: 'a1', currentClusterId: 'c1', title: 'Hospital Update', embedding: [0.95, 0.05, 0] },
      { articleId: 'a2', currentClusterId: 'c2', title: 'Court Hearing', embedding: [0.05, 0.95, 0] },
    ];

    const res = await classifyArticleThreads('Saga Title', threads, articles);

    expect(res).toEqual([
      { articleId: 'a1', targetClusterId: 'c1' },
      { articleId: 'a2', targetClusterId: 'c2' },
    ]);
  });

  it('preserves established assignments in existing stories for un-ambiguous articles', async () => {
    const threads = [
      { clusterId: 'c1', thread: 'Hospital Care' },
      { clusterId: 'c2', thread: 'Court Case' },
    ];

    const articles = [
      { articleId: 'a1', currentClusterId: 'c1', title: 'Established Article' },
    ];

    const res = await classifyArticleThreads(
      'Saga Title',
      threads,
      articles,
      { isExistingStory: true, newClusterIds: new Set() }
    );

    expect(res).toEqual([{ articleId: 'a1', targetClusterId: 'c1' }]);
  });

  it('evaluates ambiguous articles via TypeSafe Jev and gates assignments by confidence', async () => {
    const threads = [
      { clusterId: 'c1', thread: 'Hospital Care', embedding: [1, 0, 0] },
      { clusterId: 'c2', thread: 'Court Case', embedding: [0, 1, 0] },
    ];

    const articles = [
      { articleId: 'a_ambiguous', currentClusterId: 'c_other', title: 'Unclear Article' },
    ];

    const mockClassifyBatch = jest.fn().mockResolvedValue([
      { articleId: 'a_ambiguous', targetClusterId: 'c1', confidence: 0.88, choice: 'thread_c1' },
    ]);

    const res = await classifyArticleThreads(
      'Saga Title',
      threads,
      articles,
      undefined,
      { classifyBatch: mockClassifyBatch as any }
    );

    expect(mockClassifyBatch).toHaveBeenCalledTimes(1);
    expect(res).toEqual([{ articleId: 'a_ambiguous', targetClusterId: 'c1' }]);
  });

  it('routes ambiguous articles through injected classifyBatch dependency when provided', async () => {
    const threads = [
      { clusterId: 'c1', thread: 'Hospital Care', embedding: [1, 0, 0] },
      { clusterId: 'c2', thread: 'Court Case', embedding: [0, 1, 0] },
    ];

    const testArticles = [
      { articleId: 'a-matching', currentClusterId: 'c1', title: 'Court proceedings resume' },
      { articleId: 'a-unrelated', currentClusterId: 'c1', title: 'Unrelated sports news' },
    ];

    const mockClassifyBatch = jest.fn().mockResolvedValue([
      { articleId: 'a-matching', targetClusterId: 'c2', confidence: 0.95, choice: 'thread_c2' },
      { articleId: 'a-unrelated', targetClusterId: null, confidence: 0.99, choice: 'none_of_the_above' },
    ]);

    const assignments = await classifyArticleThreads(
      'Major Legal Saga',
      threads,
      testArticles,
      undefined,
      { classifyBatch: mockClassifyBatch as any }
    );

    expect(mockClassifyBatch).toHaveBeenCalledTimes(1);
    // Only a-matching should be reassigned to c2; a-unrelated should not be reassigned
    expect(assignments).toEqual([
      { articleId: 'a-matching', targetClusterId: 'c2' },
    ]);
  });
});
