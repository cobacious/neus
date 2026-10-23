import { jest } from '@jest/globals';

const mockGenerateStructuredJson = jest.fn();

jest.unstable_mockModule('../../../lib/aiClient', () => ({
  generateStructuredJson: mockGenerateStructuredJson,
}));

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

    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();
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

    expect(mockGenerateStructuredJson).not.toHaveBeenCalled();
    expect(res).toEqual([{ articleId: 'a1', targetClusterId: 'c1' }]);
  });

  it('falls back to LLM for ambiguous articles', async () => {
    const threads = [
      { clusterId: 'c1', thread: 'Hospital Care', embedding: [1, 0, 0] },
      { clusterId: 'c2', thread: 'Court Case', embedding: [0, 1, 0] },
    ];

    const articles = [
      { articleId: 'a_ambiguous', currentClusterId: 'c_other', title: 'Unclear Article' },
    ];

    (mockGenerateStructuredJson as jest.Mock).mockResolvedValue({
      assignments: [{ articleId: 'a_ambiguous', targetClusterId: 'c1' }],
    });

    const res = await classifyArticleThreads('Saga Title', threads, articles);

    expect(mockGenerateStructuredJson).toHaveBeenCalledTimes(1);
    expect(res).toEqual([{ articleId: 'a_ambiguous', targetClusterId: 'c1' }]);
  });
});
