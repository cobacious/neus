import { jest } from '@jest/globals';
import handler, { generateRssXml, ClusterFeedItem } from '../api/feed';

describe('RSS Feed Generator', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('generates valid RSS XML for empty cluster list', () => {
    const fixedDate = new Date('2026-10-16T12:00:00Z');
    const xml = generateRssXml([], fixedDate);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
    expect(xml).toContain('<title>Neus - Neutral News</title>');
    expect(xml).toContain('<link>https://neus.news</link>');
    expect(xml).toContain('<lastBuildDate>Fri, 16 Oct 2026 12:00:00 GMT</lastBuildDate>');
    expect(xml).toContain('<atom:link href="https://neus.news/feed.xml" rel="self" type="application/rss+xml" />');
    expect(xml).not.toContain('<item>');
  });

  it('generates single item for standalone cluster and escapes characters', () => {
    const fixedDate = new Date('2026-10-16T12:00:00Z');
    const clusters: ClusterFeedItem[] = [
      {
        id: 'cluster-1',
        headline: 'Scientists Discover "Novel" & Rare Species <Marine>',
        slug: 'scientists-discover-novel-species',
        summary: "Analysis of the deep-sea findings & researchers' commentary.",
        createdAt: new Date('2026-10-16T10:00:00Z').getTime(),
        lastUpdatedAt: new Date('2026-10-16T11:00:00Z').getTime(),
        articleCount: 14,
      },
    ];

    const xml = generateRssXml(clusters, fixedDate);

    expect(xml).toContain('<title>Scientists Discover &quot;Novel&quot; &amp; Rare Species &lt;Marine&gt;</title>');
    expect(xml).toContain('<link>https://neus.news/scientists-discover-novel-species</link>');
    expect(xml).toContain('<guid isPermaLink="true">https://neus.news/scientists-discover-novel-species</guid>');
    expect(xml).toContain('<pubDate>Fri, 16 Oct 2026 11:00:00 GMT</pubDate>');
    expect(xml).toContain('Analysis of the deep-sea findings &amp; researchers&apos; commentary.');
    expect(xml).toContain('Synthesised from 14 independent articles.');
  });

  it('groups multi-angle story into single RSS entry with all perspectives listed', () => {
    const fixedDate = new Date('2026-10-16T12:00:00Z');
    const clusters: ClusterFeedItem[] = [
      {
        id: 'angle-1',
        headline: 'Tiger Incident Enclosure Reopens to Visitors',
        slug: 'tiger-incident-reopening',
        summary: 'Park management reopened the enclosure following the fatal event.',
        storyAngle: 'Park Reopening',
        articleCount: 10,
        createdAt: new Date('2026-10-16T08:00:00Z').getTime(),
        lastUpdatedAt: new Date('2026-10-16T10:30:00Z').getTime(),
        storyId: 'story-tiger',
        story: {
          id: 'story-tiger',
          title: 'Yorkshire Wildlife Park Tiger Incident and Inquiries',
          overview: 'A fatal tiger encounter led to park closures and council investigations.',
          clusters: [
            {
              id: 'angle-1',
              headline: 'Tiger Incident Enclosure Reopens to Visitors',
              slug: 'tiger-incident-reopening',
              summary: 'Park management reopened the enclosure following the fatal event.',
              storyAngle: 'Park Reopening',
              articleCount: 10,
              createdAt: new Date('2026-10-16T08:00:00Z').getTime(),
              lastUpdatedAt: new Date('2026-10-16T10:30:00Z').getTime(),
            },
            {
              id: 'angle-2',
              headline: 'Family Issues Tribute to William Chapman',
              slug: 'william-chapman-tribute',
              summary: 'Relatives remembered the former actor and noted his mental health struggles.',
              storyAngle: 'Family Tribute',
              articleCount: 29,
              createdAt: new Date('2026-10-15T14:00:00Z').getTime(),
              lastUpdatedAt: new Date('2026-10-16T11:45:00Z').getTime(),
            },
          ],
        },
      },
      // Second cluster in the feed belongs to the same story
      {
        id: 'angle-2',
        headline: 'Family Issues Tribute to William Chapman',
        slug: 'william-chapman-tribute',
        summary: 'Relatives remembered the former actor and noted his mental health struggles.',
        storyAngle: 'Family Tribute',
        articleCount: 29,
        createdAt: new Date('2026-10-15T14:00:00Z').getTime(),
        lastUpdatedAt: new Date('2026-10-16T11:45:00Z').getTime(),
        storyId: 'story-tiger',
        story: {
          id: 'story-tiger',
          title: 'Yorkshire Wildlife Park Tiger Incident and Inquiries',
          overview: 'A fatal tiger encounter led to park closures and council investigations.',
          clusters: [],
        },
      },
    ];

    const xml = generateRssXml(clusters, fixedDate);

    // Should only have 1 item, not 2
    const itemCount = (xml.match(/<item>/g) || []).length;
    expect(itemCount).toBe(1);

    expect(xml).toContain('<title>Yorkshire Wildlife Park Tiger Incident and Inquiries</title>');
    expect(xml).toContain('<link>https://neus.news/tiger-incident-reopening</link>');
    expect(xml).toContain('<pubDate>Fri, 16 Oct 2026 11:45:00 GMT</pubDate>');
    expect(xml).toContain('A fatal tiger encounter led to park closures and council investigations.');
    expect(xml).toContain('Tracked Perspectives and Threads:');
    expect(xml).toContain('<strong>Park Reopening</strong> (10 articles): Park management reopened the enclosure following the fatal event.');
    expect(xml).toContain('<strong>Family Tribute</strong> (29 articles): Relatives remembered the former actor and noted his mental health struggles.');
  });

  it('handler serves RSS XML with proper headers in Node.js environment', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          clusters: [
            {
              id: 'c1',
              headline: 'Sample Headline',
              slug: 'sample-headline',
              summary: 'Sample summary text.',
              createdAt: 1729080000000,
              articleCount: 5,
            },
          ],
        },
      }),
    } as any);

    let sentStatus = 0;
    let sentBody = '';
    const headers: Record<string, string> = {};

    const req = {};
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
    expect(headers['Content-Type']).toBe('application/rss+xml; charset=utf-8');
    expect(headers['Cache-Control']).toContain('public, max-age=600');
    expect(sentBody).toContain('<title>Sample Headline</title>');
    expect(sentBody).toContain('https://neus.news/sample-headline');
  });

  it('handler returns fallback XML on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error') as never);

    let sentStatus = 0;
    let sentBody = '';
    const req = {};
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
    expect(sentBody).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
    expect(sentBody).toContain('<title>Neus - Neutral News</title>');
    expect(sentBody).not.toContain('<item>');
  });

  it('works in Web Request / Response Edge runtime', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          clusters: [
            {
              id: 'c2',
              headline: 'Edge Cluster Headline',
              slug: 'edge-cluster-headline',
              summary: 'Edge summary',
              createdAt: 1729080000000,
              articleCount: 3,
            },
          ],
        },
      }),
    } as any);

    const req = new Request('https://neus.news/feed.xml');
    const response = await handler(req);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/rss+xml; charset=utf-8');
    const text = await response.text();
    expect(text).toContain('<title>Edge Cluster Headline</title>');
  });
});
