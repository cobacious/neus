function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const DEFAULT_TITLE = 'Neus - Neutral News';
const DEFAULT_DESCRIPTION =
  'Bringing balance and neutrality to the news feed without clickbait or bias.';
const DEFAULT_IMAGE = 'https://neus.news/og-image.png';
const SITE_URL = 'https://neus.news';

export interface PrerenderAngle {
  id: string;
  headline?: string | null;
  summary?: string | null;
  storyAngle?: string | null;
  articleCount?: number | null;
}

export interface PrerenderArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt?: string | null;
  author?: string | null;
}

export interface PrerenderClusterData {
  id: string;
  headline?: string | null;
  summary?: string | null;
  storyAngle?: string | null;
  articleCount?: number | null;
  createdAt?: number | null;
  lastUpdatedAt?: number | null;
  story?: {
    id: string;
    title: string;
    overview?: string | null;
    clusters?: PrerenderAngle[] | null;
  } | null;
  articles?: PrerenderArticle[] | null;
}

export function buildSemanticHtml(
  title: string,
  description: string,
  cluster: PrerenderClusterData | null
): string {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);

  const story = cluster?.story;
  const isMultiAngle = Boolean(story && story.clusters && story.clusters.length > 1);
  const angles = (story?.clusters || []).filter(Boolean);
  const articles = (cluster?.articles || []).filter(Boolean);

  let anglesSection = '';
  if (isMultiAngle && angles.length > 0) {
    const angleCards = angles
      .map((angle) => {
        const angleTitle = escapeHtml(angle.storyAngle || angle.headline || 'General Perspective');
        const countText = angle.articleCount ? ` (${angle.articleCount} articles)` : '';
        const summaryText = angle.summary ? `\n        <p style="font-size: 0.9375rem; color: #4b5563; line-height: 1.5; margin-top: 0.25rem;">${escapeHtml(angle.summary)}</p>` : '';
        return `      <div style="margin-bottom: 1rem; padding: 1rem; background-color: #f9fafb; border-left: 4px solid #4F6D7A; border-radius: 0.375rem;">
        <h3 style="font-size: 1rem; font-weight: 600; margin: 0;">${angleTitle}${countText}</h3>${summaryText}
      </div>`;
      })
      .join('\n');

    anglesSection = `\n    <section aria-label="Tracked Perspectives" style="margin-top: 2rem;">
      <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Tracked Reporting Perspectives (${angles.length} threads)</h2>
${angleCards}
    </section>`;
  }

  let articlesSection = '';
  if (articles.length > 0) {
    const articleList = articles
      .slice(0, 15)
      .map((art) => {
        const safeArtTitle = escapeHtml(art.title);
        const safeUrl = escapeHtml(art.url);
        const safeSource = escapeHtml(art.source);
        return `        <li style="margin-bottom: 0.5rem;"><a href="${safeUrl}" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${safeArtTitle}</a> <span style="color: #6b7280;">(${safeSource})</span></li>`;
      })
      .join('\n');

    articlesSection = `\n    <section aria-label="Referenced Sources" style="margin-top: 2rem;">
      <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Referenced News Coverage (${articles.length} sources)</h2>
      <ul style="list-style-type: disc; padding-left: 1.25rem; line-height: 1.6;">
${articleList}
      </ul>
    </section>`;
  }

  return `<div id="root">
  <article style="max-width: 48rem; margin: 0 auto; padding: 2rem 1rem; font-family: system-ui, -apple-system, sans-serif; color: #1f2937;">
    <header>
      <p style="font-size: 0.875rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Neus · Neutral News Analysis</p>
      <h1>${safeTitle}</h1>
      <p style="font-size: 1.125rem; line-height: 1.6; color: #374151; margin-bottom: 1.5rem;">${safeDescription}</p>
    </header>${anglesSection}${articlesSection}
  </article>
</div>`;
}

export function buildJsonLd(
  title: string,
  description: string,
  canonicalUrl: string,
  cluster: PrerenderClusterData | null
): string {
  const publishedTime = cluster?.createdAt ? new Date(cluster.createdAt).toISOString() : new Date().toISOString();
  const modifiedTime = cluster?.lastUpdatedAt ? new Date(cluster.lastUpdatedAt).toISOString() : publishedTime;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description,
    mainEntityOfPage: canonicalUrl,
    datePublished: publishedTime,
    dateModified: modifiedTime,
    image: [DEFAULT_IMAGE],
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: 'Neus',
      url: SITE_URL,
    },
  };

  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function handler(req: any, res?: any) {
  // Extract slug from query string or request URL
  let slug = '';
  if (req.query && typeof req.query.slug === 'string') {
    slug = req.query.slug;
  } else if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      slug = parsedUrl.searchParams.get('slug') || '';
    } catch {
      // Fallback if URL parsing fails
    }
  }

  // Clean slug
  slug = slug.trim().replace(/^\/+|\/+$/g, '');

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  const canonicalUrl = slug ? `${SITE_URL}/${slug}` : SITE_URL;
  let clusterData: PrerenderClusterData | null = null;

  // 1. Fetch cluster metadata if slug is present
  if (slug) {
    try {
      const apiUrl =
        process.env.VITE_API_URL ||
        process.env.API_URL ||
        'https://neusapi-production.up.railway.app/graphql';

      const query = JSON.stringify({
        query: `query GetClusterPrerender($slug: String!) {
          cluster(slug: $slug) {
            id
            headline
            summary
            storyAngle
            articleCount
            createdAt
            lastUpdatedAt
            story {
              id
              title
              overview
              clusters {
                id
                headline
                summary
                storyAngle
                articleCount
              }
            }
            articles {
              id
              title
              url
              source
              publishedAt
              author
            }
          }
        }`,
        variables: { slug },
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Neus-Prerender-Bot/1.0',
        },
        body: query,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json: any = await response.json();
        const cluster = json?.data?.cluster;
        if (cluster) {
          clusterData = cluster;
          const story = cluster.story;
          const isMultiAngle = Boolean(story && story.clusters && story.clusters.length > 1);
          if (isMultiAngle && story?.title) {
            title = story.title;
            description = story.overview || cluster.summary || DEFAULT_DESCRIPTION;
          } else if (cluster.headline) {
            title = cluster.headline;
            description = cluster.summary || DEFAULT_DESCRIPTION;
          }
        }
      }
    } catch (err) {
      console.error('Error fetching cluster metadata for prerender:', err);
    }
  }

  // 2. Fetch the built index.html from disk or host so React bundle scripts are preserved
  let html = '';
  try {
    const fs = await import('fs');
    const path = await import('path');
    const candidates = [
      path.join(process.cwd(), 'dist', 'index.html'),
      path.join(process.cwd(), 'apps', 'web', 'dist', 'index.html'),
      path.join(process.cwd(), 'apps', 'web', 'index.html'),
      path.join(process.cwd(), 'index.html'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        html = fs.readFileSync(c, 'utf8');
        break;
      }
    }
  } catch {
    // Disk read failed, fallback to network
  }

  if (!html) {
    try {
      const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'neus.news';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const indexRes = await fetch(`${protocol}://${host}/index.html`);
      if (indexRes.ok) {
        html = await indexRes.text();
      }
    } catch {
      // Fallback template if fetching index.html fails
    }
  }

  const safeTitle = escapeHtml(title);
  const pageTitle = slug ? `${safeTitle} - Neus` : safeTitle;
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(canonicalUrl);
  const jsonLd = buildJsonLd(title, description, canonicalUrl, clusterData);
  const semanticRoot = buildSemanticHtml(title, description, clusterData);

  // 3. Inject cluster-specific meta tags and semantic body
  if (html) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${pageTitle}</title>`);
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/,
      `<meta name="description" content="${safeDescription}" />`
    );
    html = html.replace(
      /<meta\s+property=["']og:title["'][^>]*>/,
      `<meta property="og:title" content="${safeTitle}" />`
    );
    html = html.replace(
      /<meta\s+property=["']og:description["'][^>]*>/,
      `<meta property="og:description" content="${safeDescription}" />`
    );
    html = html.replace(
      /<meta\s+property=["']og:url["'][^>]*>/,
      `<meta property="og:url" content="${safeUrl}" />`
    );
    html = html.replace(
      /<meta\s+name=["']twitter:title["'][^>]*>/,
      `<meta name="twitter:title" content="${safeTitle}" />`
    );
    html = html.replace(
      /<meta\s+name=["']twitter:description["'][^>]*>/,
      `<meta name="twitter:description" content="${safeDescription}" />`
    );

    html = html.replace(
      /<meta\s+property=["']og:image["'][^>]*>/,
      `<meta property="og:image" content="${DEFAULT_IMAGE}" />`
    );
    html = html.replace(
      /<meta\s+property=["']og:image:height["'][^>]*>/,
      '<meta property="og:image:height" content="480" />'
    );
    html = html.replace(
      /<meta\s+property=["']og:image:alt["'][^>]*>/,
      `<meta property="og:image:alt" content="${safeTitle} - Neus" />`
    );
    html = html.replace(
      /<meta\s+name=["']twitter:image["'][^>]*>/,
      `<meta name="twitter:image" content="${DEFAULT_IMAGE}" />`
    );
    html = html.replace(
      /<meta\s+name=["']twitter:card["'][^>]*>/,
      '<meta name="twitter:card" content="summary_large_image" />'
    );

    // Inject JSON-LD structured data into head
    const jsonLdTag = `<script type="application/ld+json">${jsonLd}</script>`;
    html = html.replace('</head>', `  ${jsonLdTag}\n</head>`);

    // Inject semantic pre-rendered HTML into #root
    html = html.replace(/<div id=["']root["']>[\s\S]*?<\/div>/, semanticRoot);
  } else {
    // Minimal fallback HTML if template cannot be retrieved
    const imageTag = `<meta property="og:image" content="${DEFAULT_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="480" />
  <meta name="twitter:image" content="${DEFAULT_IMAGE}" />`;
    const twitterCard = 'summary_large_image';

    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${pageTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta property="og:site_name" content="Neus" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:url" content="${safeUrl}" />
  ${imageTag}
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <script type="application/ld+json">${jsonLd}</script>
  <meta http-equiv="refresh" content="0; url=${slug ? `/${escapeHtml(slug)}` : '/'}" />
</head>
<body>${semanticRoot}</body>
</html>`;
  }

  // Support Node.js runtime
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
    );
    if (typeof res.status === 'function') {
      return res.status(200).send(html);
    }
    res.statusCode = 200;
    return res.end(html);
  }

  // Support Web Request/Response Edge runtime
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
