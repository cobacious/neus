import { jest } from '@jest/globals';
import handler, { generateSitemapXml, SitemapClusterItem } from '../api/sitemap';

describe('Dynamic Sitemap Generator', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('generates static URLs when cluster list is empty', () => {
    const xml = generateSitemapXml([]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://neus.news/</loc>');
    expect(xml).toContain('<loc>https://neus.news/about</loc>');
    expect(xml).toContain('<changefreq>hourly</changefreq>');
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml).toContain('<changefreq>monthly</changefreq>');
    expect(xml).toContain('<priority>0.5</priority>');
  });

  it('includes cluster URLs with formatted lastmod dates', () => {
    const clusters: SitemapClusterItem[] = [
      {
        id: 'c1',
        slug: 'tiger-incident-at-yorkshire-wildlife-park',
        createdAt: new Date('2026-10-15T10:00:00Z').getTime(),
        lastUpdatedAt: new Date('2026-10-16T14:30:00Z').getTime(),
      },
      {
        id: 'c2',
        slug: 'pope-recovery-update',
        createdAt: new Date('2026-10-14T09:00:00Z').getTime(),
      },
      // Duplicate slug should be deduplicated
      {
        id: 'c3',
        slug: 'pope-recovery-update',
        createdAt: new Date('2026-10-14T09:00:00Z').getTime(),
      },
    ];

    const xml = generateSitemapXml(clusters);

    expect(xml).toContain('<loc>https://neus.news/tiger-incident-at-yorkshire-wildlife-park</loc>');
    expect(xml).toContain('<lastmod>2026-10-16</lastmod>');
    expect(xml).toContain('<loc>https://neus.news/pope-recovery-update</loc>');
    expect(xml).toContain('<lastmod>2026-10-14</lastmod>');

    const popeCount = (xml.match(/pope-recovery-update/g) || []).length;
    expect(popeCount).toBe(1);
  });

  it('handler serves sitemap XML with cache headers in Node.js runtime', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          clusters: [
            {
              id: 'c1',
              slug: 'test-cluster',
              createdAt: 1729080000000,
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
    expect(headers['Content-Type']).toBe('application/xml; charset=utf-8');
    expect(headers['Cache-Control']).toContain('public, max-age=3600');
    expect(sentBody).toContain('<loc>https://neus.news/test-cluster</loc>');
  });

  it('handler returns static URLs on fetch failure', async () => {
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
    expect(sentBody).toContain('<loc>https://neus.news/</loc>');
    expect(sentBody).toContain('<loc>https://neus.news/about</loc>');
  });

  it('works in Web Request / Response Edge runtime', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          clusters: [
            {
              id: 'c1',
              slug: 'edge-sitemap-cluster',
              createdAt: 1729080000000,
            },
          ],
        },
      }),
    } as any);

    const req = new Request('https://neus.news/sitemap.xml');
    const response = await handler(req);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    const text = await response.text();
    expect(text).toContain('<loc>https://neus.news/edge-sitemap-cluster</loc>');
  });
});
