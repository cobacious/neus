import { jest } from '@jest/globals';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';

const mockGetActiveSources = jest.fn();
const mockSyncArticles = jest.fn();
const mockCountUnclusteredArticles = jest.fn();
const mockGetRecentArticlesForPulse = jest.fn();
const mockGetLatestPipelineRunTime = jest.fn();

jest.unstable_mockModule('@neus/db', () => ({
  getActiveSources: mockGetActiveSources,
  syncArticles: mockSyncArticles,
  countUnclusteredArticles: mockCountUnclusteredArticles,
  getRecentArticlesForPulse: mockGetRecentArticlesForPulse,
  getLatestPipelineRunTime: mockGetLatestPipelineRunTime,
  isPaywalledSource: () => false,
  evaluatePulseTrigger: jest.fn().mockReturnValue({
    shouldTrigger: false,
    reason: 'insufficient_activity',
    metrics: {
      minutesSinceLastRun: 75,
      unclusteredArticleCount: 10,
      recentArticleCount: 5,
    },
  }),
}));

const mockParseURL = jest.fn();
jest.unstable_mockModule('rss-parser', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      parseURL: mockParseURL,
    })),
  };
});

let authorizePulseRequest: typeof import('./pulse').authorizePulseRequest;
let executePulse: typeof import('./pulse').executePulse;
let handlePulseHttpRequest: typeof import('./pulse').handlePulseHttpRequest;

beforeAll(async () => {
  ({ authorizePulseRequest, executePulse, handlePulseHttpRequest } = await import('./pulse'));
});

describe('Pulse API Endpoint', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'test', PULSE_SECRET: 'test-secret' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('authorizePulseRequest', () => {
    it('authorizes valid Bearer header', () => {
      const req = {
        headers: { authorization: 'Bearer test-secret' },
      } as unknown as IncomingMessage;
      const url = new URL('http://localhost:4000/api/pulse');

      expect(authorizePulseRequest(req, url)).toBe(true);
    });

    it('authorizes valid query parameter secret', () => {
      const req = { headers: {} } as unknown as IncomingMessage;
      const url = new URL('http://localhost:4000/api/pulse?secret=test-secret');

      expect(authorizePulseRequest(req, url)).toBe(true);
    });

    it('rejects invalid secret', () => {
      const req = {
        headers: { authorization: 'Bearer wrong-secret' },
      } as unknown as IncomingMessage;
      const url = new URL('http://localhost:4000/api/pulse?secret=invalid');

      expect(authorizePulseRequest(req, url)).toBe(false);
    });

    it('rejects when secret is missing and configured', () => {
      const req = { headers: {} } as unknown as IncomingMessage;
      const url = new URL('http://localhost:4000/api/pulse');

      expect(authorizePulseRequest(req, url)).toBe(false);
    });
  });

  describe('executePulse', () => {
    it('runs feed ingestion, syncs articles, and respects dryRun=true', async () => {
      (mockGetActiveSources as jest.Mock).mockResolvedValue([
        { id: 'src-1', name: 'BBC News', rssFeedUrl: 'https://feeds.bbci.co.uk/news/rss.xml' },
      ]);
      (mockParseURL as jest.Mock).mockResolvedValue({
        items: [
          {
            link: 'https://bbc.com/news/1',
            title: 'Test Headline 1',
            isoDate: new Date().toISOString(),
            contentSnippet: 'Snippet text',
          },
        ],
      });
      (mockSyncArticles as jest.Mock).mockResolvedValue({
        created: 1,
        updated: 0,
        unchanged: 0,
      });
      (mockCountUnclusteredArticles as jest.Mock).mockResolvedValue(12);
      (mockGetRecentArticlesForPulse as jest.Mock).mockResolvedValue([]);
      (mockGetLatestPipelineRunTime as jest.Mock).mockResolvedValue(new Date(Date.now() - 90 * 60 * 1000));

      const result = await executePulse({ dryRun: true });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.ingestion.activeSources).toBe(1);
      expect(result.ingestion.successfulFeeds).toBe(1);
      expect(result.ingestion.newArticles).toBe(1);
      expect(result.dispatch.dispatched).toBe(false);
      expect(result.dispatch.reason).toBe('Dry run mode active');
    });
  });

  describe('handlePulseHttpRequest', () => {
    function createMockRes(): {
      res: ServerResponse;
      statusCode?: number;
      headers?: Record<string, string>;
      body?: string;
    } {
      const output: {
        res: ServerResponse;
        statusCode?: number;
        headers?: Record<string, string>;
        body?: string;
      } = {} as any;

      const res = {
        writeHead: jest.fn((code: number, headers?: any) => {
          output.statusCode = code;
          output.headers = headers;
        }),
        end: jest.fn((body?: string) => {
          output.body = body;
        }),
      } as unknown as ServerResponse;

      output.res = res;
      return output;
    }

    it('rejects PUT/DELETE requests with 405 Method Not Allowed', async () => {
      const req = {
        method: 'DELETE',
        url: '/api/pulse',
        headers: { host: 'localhost:4000', authorization: 'Bearer test-secret' },
      } as unknown as IncomingMessage;
      const { res } = createMockRes();

      await handlePulseHttpRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
    });

    it('rejects unauthorized requests with 401', async () => {
      const req = {
        method: 'GET',
        url: '/api/pulse',
        headers: { host: 'localhost:4000' },
      } as unknown as IncomingMessage;
      const { res } = createMockRes();

      await handlePulseHttpRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    });

    it('processes authorized GET request with dryRun and returns 200', async () => {
      (mockGetActiveSources as jest.Mock).mockResolvedValue([]);
      (mockCountUnclusteredArticles as jest.Mock).mockResolvedValue(0);
      (mockGetRecentArticlesForPulse as jest.Mock).mockResolvedValue([]);
      (mockGetLatestPipelineRunTime as jest.Mock).mockResolvedValue(null);

      const req = Object.assign(new EventEmitter(), {
        method: 'GET',
        url: '/api/pulse?dryRun=true',
        headers: { host: 'localhost:4000', authorization: 'Bearer test-secret' },
      }) as unknown as IncomingMessage;
      const mockRes = createMockRes();

      await handlePulseHttpRequest(req, mockRes.res);

      expect(mockRes.res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      const parsed = JSON.parse(mockRes.body || '{}');
      expect(parsed.success).toBe(true);
      expect(parsed.dryRun).toBe(true);
    });
  });
});
