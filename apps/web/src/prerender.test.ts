import { jest } from '@jest/globals';
import handler, { buildSemanticHtml, buildJsonLd } from '../api/prerender';

describe('Prerender Handler', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('buildSemanticHtml generates clean semantic markup for multi-thread stories', () => {
    const html = buildSemanticHtml(
      'Yorkshire Wildlife Park Incident',
      'Overview of the incident and subsequent inquiries.',
      {
        id: 'c1',
        story: {
          id: 's1',
          title: 'Yorkshire Wildlife Park Incident',
          overview: 'Overview of the incident and subsequent inquiries.',
          clusters: [
            {
              id: 'a1',
              storyAngle: 'Initial Attack Details',
              articleCount: 39,
              summary: 'A visitor entered the enclosure on Saturday.',
            },
            {
              id: 'a2',
              storyAngle: 'Family Tribute',
              articleCount: 29,
              summary: 'Relatives remembered the former actor.',
            },
          ],
        },
        articles: [
          {
            id: 'art-1',
            title: 'Police Issue Statement Following Park Incident',
            url: 'https://news.bbc.co.uk/1',
            source: 'BBC News',
          },
        ],
      }
    );

    expect(html).toContain('<div id="root">');
    expect(html).toContain('<h1>Yorkshire Wildlife Park Incident</h1>');
    expect(html).toContain('<p style="font-size: 1.125rem; line-height: 1.6; color: #374151; margin-bottom: 1.5rem;">Overview of the incident and subsequent inquiries.</p>');
    expect(html).toContain('Tracked Reporting Perspectives (2 threads)');
    expect(html).toContain('Initial Attack Details (39 articles)');
    expect(html).toContain('Family Tribute (29 articles)');
    expect(html).toContain('Referenced News Coverage (1 sources)');
    expect(html).toContain('https://news.bbc.co.uk/1');
    expect(html).toContain('Police Issue Statement Following Park Incident');
    expect(html).toContain('(BBC News)');
  });

  it('buildJsonLd creates valid Schema.org NewsArticle structured data', () => {
    const jsonStr = buildJsonLd(
      'Test Headline',
      'Test Summary',
      'https://neus.news/test-story',
      {
        id: 'c1',
        createdAt: 1729000000000,
        lastUpdatedAt: 1729100000000,
      }
    );

    const parsed = JSON.parse(jsonStr);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('NewsArticle');
    expect(parsed.headline).toBe('Test Headline');
    expect(parsed.description).toBe('Test Summary');
    expect(parsed.mainEntityOfPage).toBe('https://neus.news/test-story');
    expect(parsed.publisher.name).toBe('Neus');
    expect(parsed.datePublished).toBe(new Date(1729000000000).toISOString());
    expect(parsed.dateModified).toBe(new Date(1729100000000).toISOString());
  });

  it('returns fallback metadata and markup when no slug is provided', async () => {
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
      '<meta property="og:description" content="Bringing balance and neutrality to the news feed without clickbait or bias." />'
    );
    expect(sentBody).toContain('content="https://neus.news/og-image.png"');
    expect(sentBody).toContain('"@type":"NewsArticle"');
    expect(headers['Content-Type']).toContain('text/html');
  });

  it('fetches cluster and injects dynamic metadata and semantic body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          cluster: {
            id: 'c1',
            headline: 'Tiger Incident at Yorkshire Wildlife Park',
            summary: 'A visitor entered the enclosure and suffered injuries.',
            storyAngle: 'Initial Attack',
            articleCount: 15,
            articles: [
              {
                id: 'a1',
                title: 'Park Confirms Visitor Incident',
                url: 'https://example.com/tiger',
                source: 'Example News',
              },
            ],
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
      '<meta property="og:title" content="Tiger Incident at Yorkshire Wildlife Park" />'
    );
    expect(sentBody).toContain(
      '<meta property="og:description" content="A visitor entered the enclosure and suffered injuries." />'
    );
    expect(sentBody).toContain('<h1>Tiger Incident at Yorkshire Wildlife Park</h1>');
    expect(sentBody).toContain('A visitor entered the enclosure and suffered injuries.');
    expect(sentBody).toContain('https://example.com/tiger');
    expect(sentBody).toContain('Park Confirms Visitor Incident');
    expect(sentBody).toContain('(Example News)');
    expect(sentBody).toContain('"@type":"NewsArticle"');
  });

  it('escapes special characters to prevent broken HTML or XSS', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          cluster: {
            id: 'c2',
            headline: 'US "Shock & Awe" Plan Criticised by <Experts>',
            summary: "Analysis of the 'unprecedented' move & its impact.",
            storyAngle: 'Reactions',
            articleCount: 5,
            articles: [],
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
            id: 'c3',
            headline: 'Test Story',
            summary: 'Test Summary',
            articles: [],
          },
        },
      }),
    } as any);

    const req = new Request('https://neus.news/api/prerender?slug=test-story');
    const response = await handler(req);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<title>Test Story - Neus</title>');
    expect(text).toContain('<h1>Test Story</h1>');
  });
});
