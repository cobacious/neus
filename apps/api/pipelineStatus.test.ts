import { jest } from '@jest/globals';
import { execute, parse } from 'graphql';
import { clearQueryCache } from './cache';

const mockGetPipelineStatus = jest.fn();

jest.unstable_mockModule('@neus/db', () => ({
  countClusters: jest.fn(),
  getRankedClusters: jest.fn(),
  getClusterById: jest.fn(),
  getClusterBySlug: jest.fn(),
  getStoryById: jest.fn(),
  getStoryBySlug: jest.fn(),
  getStories: jest.fn(),
  getSources: jest.fn(),
  createSource: jest.fn(),
  updateSource: jest.fn(),
  getPipelineStatus: mockGetPipelineStatus,
}));

let schema: typeof import('./schema').schema;

beforeAll(async () => {
  ({ schema } = await import('./schema'));
});

describe('GraphQL pipelineStatus query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearQueryCache();
  });

  it('resolves pipelineStatus with accurate timestamps and counts', async () => {
    const mockStatus = {
      lastRunAt: 1793618400000,
      lastRunIso: '2026-10-25T14:00:00.000Z',
      activeClusters: 24,
      totalArticles: 180,
    };
    (mockGetPipelineStatus as jest.Mock).mockResolvedValue(mockStatus);

    const document = parse(`
      query {
        pipelineStatus {
          lastRunAt
          lastRunIso
          activeClusters
          totalArticles
        }
      }
    `);

    const result = await execute({ schema, document });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      pipelineStatus: {
        lastRunAt: 1793618400000,
        lastRunIso: '2026-10-25T14:00:00.000Z',
        activeClusters: 24,
        totalArticles: 180,
      },
    });
    expect(mockGetPipelineStatus).toHaveBeenCalledTimes(1);
  });

  it('uses LRU cache and avoids redundant database queries across consecutive requests', async () => {
    const mockStatus = {
      lastRunAt: 1793618400000,
      lastRunIso: '2026-10-25T14:00:00.000Z',
      activeClusters: 10,
      totalArticles: 100,
    };
    (mockGetPipelineStatus as jest.Mock).mockResolvedValue(mockStatus);

    const document = parse(`
      query {
        pipelineStatus {
          lastRunAt
        }
      }
    `);

    const res1 = await execute({ schema, document });
    const res2 = await execute({ schema, document });

    expect(res1.data).toEqual({ pipelineStatus: { lastRunAt: 1793618400000 } });
    expect(res2.data).toEqual({ pipelineStatus: { lastRunAt: 1793618400000 } });
    expect(mockGetPipelineStatus).toHaveBeenCalledTimes(1);

    clearQueryCache();

    const res3 = await execute({ schema, document });
    expect(res3.data).toEqual({ pipelineStatus: { lastRunAt: 1793618400000 } });
    expect(mockGetPipelineStatus).toHaveBeenCalledTimes(2);
  });
});
