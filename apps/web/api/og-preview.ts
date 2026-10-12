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
  'Restoring balance and neutrality to the news feed without clickbait or bias.';
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
  let canonicalUrl = slug ? `${SITE_URL}/${slug}` : SITE_URL;
  let redirectUrl = slug ? `/${slug}` : '/';

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
          }
        }`,
        variables: { slug },
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

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
        if (cluster && cluster.headline) {
          title = `${cluster.headline} - Neus`;
          description = cluster.summary || DEFAULT_DESCRIPTION;
        }
      }
    } catch (err) {
      // Graceful fallback to default metadata on error or timeout
      console.error('Error fetching cluster metadata for preview:', err);
    }
  }

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(canonicalUrl);
  const safeRedirect = escapeHtml(redirectUrl);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />

  <!-- Open Graph / Facebook / iMessage / WhatsApp -->
  <meta property="og:site_name" content="Neus" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${DEFAULT_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="${safeTitle}" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${DEFAULT_IMAGE}" />

  <!-- Client redirect in case a human lands directly on this route -->
  <meta http-equiv="refresh" content="0; url=${safeRedirect}" />
  <link rel="canonical" href="${safeUrl}" />
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>${safeDescription}</p>
  <p><a href="${safeRedirect}">Continue to full story on Neus</a></p>
</body>
</html>`;

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
