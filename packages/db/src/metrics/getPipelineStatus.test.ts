import { jest } from '@jest/globals';

const clusterCount = jest.fn();
const articleCount = jest.fn();
const mockGetLatestPipelineRunTime = jest.fn();

jest.unstable_mockModule('../client', () => ({
  prisma: {
    cluster: {
      count: clusterCount,
    },
    article: {
      count: articleCount,
    },
  },
}));

jest.unstable_mockModule('../clusters/getLatestPipelineRunTime', () => ({
  getLatestPipelineRunTime: mockGetLatestPipelineRunTime,
}));

let getPipelineStatus: typeof import('./getPipelineStatus').getPipelineStatus;

beforeAll(async () => {
  ({ getPipelineStatus } = await import('./getPipelineStatus'));
});

describe('getPipelineStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns pipeline status with latest run timestamp and counts', async () => {
    const mockDate = new Date('2026-10-25T14:30:00Z');
    (mockGetLatestPipelineRunTime as jest.Mock).mockResolvedValue(mockDate);
    (clusterCount as jest.Mock).mockResolvedValue(42);
    (articleCount as jest.Mock).mockResolvedValue(512);

    const result = await getPipelineStatus();

    expect(result).toEqual({
      lastRunAt: mockDate.getTime(),
      lastRunIso: mockDate.toISOString(),
      activeClusters: 42,
      totalArticles: 512,
    });
    expect(clusterCount).toHaveBeenCalledWith({
      where: {
        archived: false,
      },
    });
    expect(articleCount).toHaveBeenCalledWith();
  });

  it('falls back to current time when getLatestPipelineRunTime returns null', async () => {
    (mockGetLatestPipelineRunTime as jest.Mock).mockResolvedValue(null);
    (clusterCount as jest.Mock).mockResolvedValue(0);
    (articleCount as jest.Mock).mockResolvedValue(0);

    const before = Date.now();
    const result = await getPipelineStatus();
    const after = Date.now();

    expect(result.activeClusters).toBe(0);
    expect(result.totalArticles).toBe(0);
    expect(result.lastRunAt).toBeGreaterThanOrEqual(before);
    expect(result.lastRunAt).toBeLessThanOrEqual(after);
    expect(new Date(result.lastRunIso).getTime()).toBe(result.lastRunAt);
  });
});
