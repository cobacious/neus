import { jest } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

let generateStructuredJson: typeof import('./aiClient').generateStructuredJson;
let cleanJsonResponse: typeof import('./aiClient').cleanJsonResponse;
let generateEmbedding: typeof import('./aiClient').generateEmbedding;
let openai: typeof import('./aiClient').openai;
let isGeminiActive: typeof import('./aiClient').isGeminiActive;
let resetAiClientState: typeof import('./aiClient').resetAiClientState;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = 'mock-gemini-key';
  process.env.GEMINI_API_BASE_URL = 'https://mock.gemini.api/v1beta';
  ({
    generateStructuredJson,
    cleanJsonResponse,
    generateEmbedding,
    openai,
    isGeminiActive,
    resetAiClientState,
  } = await import('./aiClient'));
});

describe('aiClient', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetAiClientState();
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

    it('falls back to OpenAI when Gemini returns 402 and disables Gemini for subsequent calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => 'Your prepayment credits are depleted',
      });

      const spy = jest.spyOn(openai!.chat.completions, 'create').mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ fallback: true }) } }],
      } as any);

      const res = await generateStructuredJson<{ fallback: boolean }>({ prompt: 'test' });
      expect(res).toEqual({ fallback: true });
      expect(spy).toHaveBeenCalled();
      expect(isGeminiActive()).toBe(false);
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

    it('falls back to OpenAI when Gemini fails with error, using 3072 dimensions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const spy = jest.spyOn(openai!.embeddings, 'create').mockResolvedValueOnce({
        data: [{ embedding: [0.4, 0.5, 0.6] }],
      } as any);

      const emb = await generateEmbedding('fallback test');
      expect(emb).toEqual([0.4, 0.5, 0.6]);
      expect(spy).toHaveBeenCalledWith({
        model: 'text-embedding-3-large',
        input: 'fallback test',
        dimensions: 3072,
      });
    });

    it('disables Gemini on 402 and routes subsequent embedding calls directly to OpenAI', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => 'Your prepayment credits are depleted',
      });

      const spy = jest.spyOn(openai!.embeddings, 'create').mockResolvedValue({
        data: [{ embedding: [0.7, 0.8, 0.9] }],
      } as any);

      expect(isGeminiActive()).toBe(true);

      // First call hits Gemini, gets 402, disables Gemini, falls back to OpenAI
      const emb1 = await generateEmbedding('first call');
      expect(emb1).toEqual([0.7, 0.8, 0.9]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(isGeminiActive()).toBe(false);

      // Second call skips Gemini completely and goes straight to OpenAI
      const emb2 = await generateEmbedding('second call');
      expect(emb2).toEqual([0.7, 0.8, 0.9]);
      expect(mockFetch).toHaveBeenCalledTimes(1); // still 1, mockFetch was NOT called again
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
