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

  // 1. Fetch cluster metadata if slug is present
  if (slug) {
    try {
      const apiUrl =
        process.env.VITE_API_URL ||
        process.env.API_URL ||
        'https://neusapi-production.up.railway.app/graphql';

      const query = JSON.stringify({
        query: `query GetClusterPreview($slug: String!) {
          cluster(slug: $slug) {
            headline
            summary
            storyAngle
            articleCount
            story {
              title
              overview
              clusters {
                id
              }
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
          'User-Agent': 'Neus-OG-Bot/1.0',
        },
        body: query,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json: any = await response.json();
        const cluster = json?.data?.cluster;
        if (cluster) {
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
      console.error('Error fetching cluster metadata for preview:', err);
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

  // 3. Inject cluster-specific meta tags
  if (html) {
    const safeTitle = escapeHtml(title);
    const pageTitle = slug ? `${safeTitle} - Neus` : safeTitle;
    const safeDescription = escapeHtml(description);
    const safeUrl = escapeHtml(canonicalUrl);

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
  } else {
    // Minimal fallback HTML if template cannot be retrieved
    const safeTitle = escapeHtml(title);
    const pageTitle = slug ? `${safeTitle} - Neus` : safeTitle;
    const safeDescription = escapeHtml(description);
    const safeUrl = escapeHtml(canonicalUrl);
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
  <meta http-equiv="refresh" content="0; url=${slug ? `/${escapeHtml(slug)}` : '/'}" />
</head>
<body><div id="root"></div></body>
</html>`;
  }

  // Support Node.js runtime
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
    );
    return res.status(200).send(html);
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
