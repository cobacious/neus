function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface SitemapClusterItem {
  id: string;
  slug?: string | null;
  createdAt?: number | null;
  lastUpdatedAt?: number | null;
}

const SITE_URL = 'https://neus.news';

export function generateSitemapXml(clusters: SitemapClusterItem[]): string {
  const urlsXml: string[] = [
    `  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>`,
    `  <url>
    <loc>${SITE_URL}/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`,
  ];

  const seenSlugs = new Set<string>();

  for (const cluster of clusters) {
    if (!cluster.slug || seenSlugs.has(cluster.slug)) continue;
    seenSlugs.add(cluster.slug);

    const loc = `${SITE_URL}/${escapeXml(cluster.slug)}`;
    const dateValue = cluster.lastUpdatedAt || cluster.createdAt;
    const lastmod = dateValue
      ? new Date(dateValue).toISOString().split('T')[0]
      : '';

    urlsXml.push(`  <url>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml.join('\n')}
</urlset>`;
}

export default async function handler(req: any, res?: any) {
  try {
    const apiUrl =
      process.env.VITE_API_URL ||
      process.env.API_URL ||
      'https://neusapi-production.up.railway.app/graphql';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query GetSitemapClusters {
          clusters(limit: 100) {
            id
            slug
            createdAt
            lastUpdatedAt
          }
        }`,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL query failed with HTTP status ${response.status}`);
    }

    const payload = (await response.json()) as any;
    const clusters: SitemapClusterItem[] = payload?.data?.clusters || [];
    const xml = generateSitemapXml(clusters);

    // Support Node.js runtime
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader(
        'Cache-Control',
        'public, max-age=3600, s-maxage=14400, stale-while-revalidate=86400'
      );
      if (typeof res.status === 'function') {
        return res.status(200).send(xml);
      }
      res.statusCode = 200;
      return res.end(xml);
    }

    // Support Web Request/Response Edge runtime
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=14400, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    const fallbackXml = generateSitemapXml([]);

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      if (typeof res.status === 'function') {
        return res.status(200).send(fallbackXml);
      }
      res.statusCode = 200;
      return res.end(fallbackXml);
    }

    return new Response(fallbackXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });
  }
}
