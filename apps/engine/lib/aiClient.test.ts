import { jest } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

let generateStructuredJson: typeof import('./aiClient').generateStructuredJson;
let cleanJsonResponse: typeof import('./aiClient').cleanJsonResponse;
let generateEmbedding: typeof import('./aiClient').generateEmbedding;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = 'mock-gemini-key';
  process.env.GEMINI_API_BASE_URL = 'https://mock.gemini.api/v1beta';
  ({
    generateStructuredJson,
    cleanJsonResponse,
    generateEmbedding,
  } = await import('./aiClient'));
});

describe('aiClient', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('cleanJsonResponse', () => {
    it('parses pure JSON string', () => {
      const res = cleanJsonResponse<{ foo: string }>('{"foo":"bar"}');
      expect(res).toEqual({ foo: 'bar' });
    });

    it('strips markdown code blocks', () => {
      const res = cleanJsonResponse<{ a: number }>('```json\n{"a":123}\n```');
      expect(res).toEqual({ a: 123 });
    });

    it('recovers JSON object when wrapped with surrounding narrative text', () => {
      const res = cleanJsonResponse<{ status: string }>('Here is your response:\n{"status":"ok"}\nHope this helps!');
      expect(res).toEqual({ status: 'ok' });
    });
  });

  describe('generateStructuredJson', () => {
    it('calls Gemini endpoint using configured base URL and parses response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ result: 'success' }) }],
              },
            },
          ],
        }),
      });

      const data = await generateStructuredJson<{ result: string }>({
        prompt: 'test prompt',
        systemInstruction: 'test system',
      });

      expect(data).toEqual({ result: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, any];
      expect(url).toContain('https://mock.gemini.api/v1beta/models/gemini-flash-latest:generateContent');
      const body = JSON.parse(options.body);
      expect(body.systemInstruction.parts[0].text).toBe('test system');
    });

    it('retries on 429 rate limit before succeeding', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ retry: 'ok' }) }],
                },
              },
            ],
          }),
        });

      const data = await generateStructuredJson<{ retry: string }>({
        prompt: 'retry prompt',
      });

      expect(data).toEqual({ retry: 'ok' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateEmbedding', () => {
    it('calls Gemini embedContent endpoint and extracts values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          embedding: { values: [0.1, 0.2, 0.3] },
        }),
      });

      const emb = await generateEmbedding('hello world');
      expect(emb).toEqual([0.1, 0.2, 0.3]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, any];
      expect(url).toContain('https://mock.gemini.api/v1beta/models/gemini-embedding-2:embedContent');
    });
  });
});
