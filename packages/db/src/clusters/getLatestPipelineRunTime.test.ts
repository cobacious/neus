import { jest } from '@jest/globals';

const clusterFindFirst = jest.fn();
const articleFindFirst = jest.fn();
const sourceFindFirst = jest.fn();

jest.unstable_mockModule('../client', () => ({
  prisma: {
    cluster: {
      findFirst: clusterFindFirst,
    },
    article: {
      findFirst: articleFindFirst,
    },
    source: {
      findFirst: sourceFindFirst,
    },
  },
}));

let getLatestPipelineRunTime: typeof import('./getLatestPipelineRunTime').getLatestPipelineRunTime;

beforeAll(async () => {
  ({ getLatestPipelineRunTime } = await import('./getLatestPipelineRunTime'));
});

describe('getLatestPipelineRunTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cluster date when cluster is newest', async () => {
    const clusterDate = new Date('2026-10-20T12:00:00Z');
    const articleDate = new Date('2026-10-20T11:00:00Z');
    const sourceDate = new Date('2026-10-20T10:00:00Z');

    (clusterFindFirst as jest.Mock).mockResolvedValue({ createdAt: clusterDate });
    (articleFindFirst as jest.Mock).mockResolvedValue({ createdAt: articleDate });
    (sourceFindFirst as jest.Mock).mockResolvedValue({ lastFetchedAt: sourceDate });

    const result = await getLatestPipelineRunTime();

    expect(result).toEqual(clusterDate);
    expect(clusterFindFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    expect(articleFindFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    expect(sourceFindFirst).toHaveBeenCalledWith({
      where: { active: true, lastFetchedAt: { not: null } },
      orderBy: { lastFetchedAt: 'desc' },
      select: { lastFetchedAt: true },
    });
  });

  it('returns article date when article is newest', async () => {
    const clusterDate = new Date('2026-10-20T09:00:00Z');
    const articleDate = new Date('2026-10-20T14:00:00Z');
    const sourceDate = new Date('2026-10-20T10:00:00Z');

    (clusterFindFirst as jest.Mock).mockResolvedValue({ createdAt: clusterDate });
    (articleFindFirst as jest.Mock).mockResolvedValue({ createdAt: articleDate });
    (sourceFindFirst as jest.Mock).mockResolvedValue({ lastFetchedAt: sourceDate });

    const result = await getLatestPipelineRunTime();

    expect(result).toEqual(articleDate);
  });

  it('returns source lastFetchedAt when source is newest', async () => {
    const clusterDate = new Date('2026-10-20T08:00:00Z');
    const articleDate = new Date('2026-10-20T09:00:00Z');
    const sourceDate = new Date('2026-10-20T16:00:00Z');

    (clusterFindFirst as jest.Mock).mockResolvedValue({ createdAt: clusterDate });
    (articleFindFirst as jest.Mock).mockResolvedValue({ createdAt: articleDate });
    (sourceFindFirst as jest.Mock).mockResolvedValue({ lastFetchedAt: sourceDate });

    const result = await getLatestPipelineRunTime();

    expect(result).toEqual(sourceDate);
  });

  it('falls back to available date when some models return null', async () => {
    const articleDate = new Date('2026-10-20T10:30:00Z');

    (clusterFindFirst as jest.Mock).mockResolvedValue(null);
    (articleFindFirst as jest.Mock).mockResolvedValue({ createdAt: articleDate });
    (sourceFindFirst as jest.Mock).mockResolvedValue(null);

    const result = await getLatestPipelineRunTime();

    expect(result).toEqual(articleDate);
  });

  it('returns null when all tables return null', async () => {
    (clusterFindFirst as jest.Mock).mockResolvedValue(null);
    (articleFindFirst as jest.Mock).mockResolvedValue(null);
    (sourceFindFirst as jest.Mock).mockResolvedValue(null);

    const result = await getLatestPipelineRunTime();

    expect(result).toBeNull();
  });
});
