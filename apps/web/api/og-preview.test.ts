import { jest } from '@jest/globals';
import handler from './og-preview';

describe('og-preview handler', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns fallback metadata when no slug is provided', async () => {
    let sentStatus = 0;
    let sentBody = '';
    const headers: Record<string, string> = {};

    const req = { query: {} };
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      status: (code: number) => {
        sentStatus = code;
        return {
          send: (body: string) => {
            sentBody = body;
          },
        };
      },
    };

    await handler(req, res);

    expect(sentStatus).toBe(200);
    expect(sentBody).toContain('<title>Neus - Neutral News</title>');
    expect(sentBody).toContain(
      '<meta property="og:description" content="Restoring balance and neutrality to the news feed without clickbait or bias." />'
    );
    expect(sentBody).toContain('content="https://neus.news/og-image.png"');
    expect(headers['Content-Type']).toContain('text/html');
  });

  it('fetches cluster and injects dynamic title and summary', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          cluster: {
            headline: 'Tiger Incident at Yorkshire Wildlife Park',
            summary: 'A visitor entered the enclosure and suffered injuries.',
            storyAngle: 'Initial Attack',
            articleCount: 15,
          },
        },
      }),
    } as any);

    let sentStatus = 0;
    let sentBody = '';

    const req = {
      query: { slug: 'tiger-incident-at-yorkshire-wildlife-park' },
    };
    const res = {
      setHeader: jest.fn(),
      status: (code: number) => {
        sentStatus = code;
        return {
          send: (body: string) => {
            sentBody = body;
          },
        };
      },
    };

    await handler(req, res);

    expect(sentStatus).toBe(200);
    expect(sentBody).toContain('<title>Tiger Incident at Yorkshire Wildlife Park - Neus</title>');
    expect(sentBody).toContain(
      '<meta property="og:title" content="Tiger Incident at Yorkshire Wildlife Park - Neus" />'
    );
    expect(sentBody).toContain(
      '<meta property="og:description" content="A visitor entered the enclosure and suffered injuries." />'
    );
    expect(sentBody).toContain(
      '<meta property="og:url" content="https://neus.news/tiger-incident-at-yorkshire-wildlife-park" />'
    );
    expect(sentBody).toContain(
      '<meta http-equiv="refresh" content="0; url=/tiger-incident-at-yorkshire-wildlife-park" />'
    );
  });

  it('escapes special characters to prevent broken HTML or XSS', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          cluster: {
            headline: 'US "Shock & Awe" Plan Criticised by <Experts>',
            summary: "Analysis of the 'unprecedented' move & its impact.",
            storyAngle: 'Reactions',
            articleCount: 5,
          },
        },
      }),
    } as any);

    let sentBody = '';
    const req = { query: { slug: 'shock-awe-plan' } };
    const res = {
      setHeader: jest.fn(),
      status: () => ({
        send: (body: string) => {
          sentBody = body;
        },
      }),
    };

    await handler(req, res);

    expect(sentBody).toContain(
      'US &quot;Shock &amp; Awe&quot; Plan Criticised by &lt;Experts&gt; - Neus'
    );
    expect(sentBody).toContain('Analysis of the &#039;unprecedented&#039; move &amp; its impact.');
    expect(sentBody).not.toContain('<Experts>');
  });

  it('works in Web Request / Response Edge runtime', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          cluster: {
            headline: 'Test Story',
            summary: 'Test Summary',
          },
        },
      }),
    } as any);

    const req = new Request('https://neus.news/api/og-preview?slug=test-story');
    const response = await handler(req);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<title>Test Story - Neus</title>');
  });
});
