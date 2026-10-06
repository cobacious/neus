import { jest } from '@jest/globals';

const queryRawMock = jest.fn();
const articleCountMock = jest.fn();
const clusterCountMock = jest.fn();
const sourceCountMock = jest.fn();

jest.unstable_mockModule('../client', () => ({
  prisma: {
    $queryRaw: queryRawMock,
    article: {
      count: articleCountMock,
    },
    cluster: {
      count: clusterCountMock,
    },
    source: {
      count: sourceCountMock,
    },
  },
}));

let getDatabaseUsageMetrics: typeof import('./getDatabaseUsageMetrics').getDatabaseUsageMetrics;
let NEON_STORAGE_LIMIT_BYTES: typeof import('./getDatabaseUsageMetrics').NEON_STORAGE_LIMIT_BYTES;
let NEON_EGRESS_LIMIT_BYTES: typeof import('./getDatabaseUsageMetrics').NEON_EGRESS_LIMIT_BYTES;
let NEON_COMPUTE_LIMIT_HOURS: typeof import('./getDatabaseUsageMetrics').NEON_COMPUTE_LIMIT_HOURS;

beforeAll(async () => {
  ({
    getDatabaseUsageMetrics,
    NEON_STORAGE_LIMIT_BYTES,
    NEON_EGRESS_LIMIT_BYTES,
    NEON_COMPUTE_LIMIT_HOURS,
  } = await import('./getDatabaseUsageMetrics'));
});

describe('getDatabaseUsageMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries database size and record counts successfully and formats usage/limit', async () => {
    queryRawMock.mockResolvedValue([
      { size_bytes: BigInt(125829120), size_pretty: '120 MB' },
    ]);
    articleCountMock
      .mockResolvedValueOnce(1500)
      .mockResolvedValueOnce(50);
    clusterCountMock
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(450);
    sourceCountMock.mockResolvedValueOnce(18);

    const metrics = await getDatabaseUsageMetrics();

    expect(metrics.storageBytes).toBe(125829120);
    expect(metrics.storageFormatted).toContain('120.0 MB / 1024 MB');
    expect(metrics.egressFormatted).toContain('5120 MB');
    expect(metrics.computeFormatted).toContain('100 CU-hrs');
    expect(metrics.totalArticles).toBe(1500);
    expect(metrics.unclusteredArticles).toBe(50);
    expect(metrics.activeClusters).toBe(120);
    expect(metrics.archivedClusters).toBe(450);
    expect(metrics.totalSources).toBe(18);
  });

  it('handles database size query error gracefully', async () => {
    queryRawMock.mockRejectedValue(new Error('pg_database_size error'));
    articleCountMock.mockResolvedValue(10);
    clusterCountMock.mockResolvedValue(5);
    sourceCountMock.mockResolvedValue(2);

    const metrics = await getDatabaseUsageMetrics();

    expect(metrics.storageBytes).toBe(0);
    expect(metrics.storageFormatted).toContain('0.0 MB / 1024 MB');
    expect(metrics.totalArticles).toBe(10);
  });
});
