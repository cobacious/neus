import sharp from 'sharp';

function escapeXml(unsafe: string | null | undefined): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  if (lines.length === maxLines && words.indexOf(currentLine.split(' ').pop() || '') < words.length - 1) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:!?]?$/, '...');
  }
  return lines;
}

const DEFAULT_HEADLINE = 'Restoring balance and neutrality to the news feed.';
const DEFAULT_SUMMARY =
  'Algorithmic multi-angle clustering, neutral AI synthesis and cross-source consensus without clickbait or rage-bait.';

function buildSvg(params: {
  headline: string;
  summary: string;
  statusText: string;
  pill1: string;
  pill2: string;
}): string {
  const headlineLines = wrapText(params.headline, 48, 2);
  const summaryLines = wrapText(params.summary, 78, 2);

  const headlineTspans = headlineLines
    .map((line, i) => `<tspan x="110" dy="${i === 0 ? 0 : 50}">${escapeXml(line)}</tspan>`)
    .join('');

  const summaryTspans = summaryLines
    .map((line, i) => `<tspan x="110" dy="${i === 0 ? 0 : 30}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .bg { fill: #F9FAFB; }
      .card { fill: #FFFFFF; stroke: #E5E7EB; stroke-width: 1.5; }
      .logo { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 52px; font-weight: 800; letter-spacing: -2.5px; fill: #111827; }
      .status-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.8px; fill: #223842; }
      .headline { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 40px; font-weight: 700; letter-spacing: -1px; fill: #111827; }
      .summary { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 400; line-height: 1.4; fill: #4B5563; }
      .pill-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; }
      .domain { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 19px; font-weight: 700; letter-spacing: -0.5px; fill: #4F6D7A; }
    </style>
    <clipPath id="card-clip">
      <rect x="40" y="40" width="1120" height="550" rx="20" ry="20" />
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" class="bg" />

  <!-- Main Card -->
  <rect x="40" y="40" width="1120" height="550" rx="20" ry="20" class="card" />

  <!-- Clip container for top stripe -->
  <g clip-path="url(#card-clip)">
    <!-- Top 6 Block-Colour Stripe -->
    <rect x="40" y="40" width="186.6" height="8" fill="#4F6D7A" />
    <rect x="226.6" y="40" width="186.6" height="8" fill="#DD6E42" />
    <rect x="413.2" y="40" width="186.6" height="8" fill="#B8C7B7" />
    <rect x="599.8" y="40" width="186.6" height="8" fill="#D2BFDE" />
    <rect x="786.4" y="40" width="186.6" height="8" fill="#805448" />
    <rect x="973" y="40" width="187" height="8" fill="#575353" />
  </g>

  <!-- Header: Logo & Status Badge -->
  <text x="110" y="135" class="logo">neus</text>

  <!-- Status Badge Container -->
  <g transform="translate(930, 95)">
    <rect width="160" height="36" rx="18" ry="18" fill="#EEF3F5" stroke="#4F6D7A" stroke-width="1.2" />
    <circle cx="22" cy="18" r="4.5" fill="#DD6E42" />
    <text x="34" y="22.5" class="status-text">${escapeXml(params.statusText)}</text>
  </g>

  <!-- Content: Headline -->
  <text x="110" y="240" class="headline">${headlineTspans}</text>

  <!-- Content: Neutral Summary -->
  <text x="110" y="365" class="summary">${summaryTspans}</text>

  <!-- Divider -->
  <line x1="110" y1="480" x2="1090" y2="480" stroke="#F3F4F6" stroke-width="1.5" />

  <!-- Footer Pills -->
  <!-- Pill 1: Angles -->
  <g transform="translate(110, 505)">
    <rect width="170" height="36" rx="18" ry="18" fill="#F3F7F8" stroke="#4F6D7A" stroke-width="1.2" />
    <text x="85" y="23" text-anchor="middle" class="pill-text" fill="#38505B">${escapeXml(params.pill1)}</text>
  </g>

  <!-- Pill 2: Sources -->
  <g transform="translate(295, 505)">
    <rect width="185" height="36" rx="18" ry="18" fill="#FCF5F2" stroke="#DD6E42" stroke-width="1.2" />
    <text x="92.5" y="23" text-anchor="middle" class="pill-text" fill="#9C4524">${escapeXml(params.pill2)}</text>
  </g>

  <!-- Pill 3: Consensus -->
  <g transform="translate(495, 505)">
    <rect width="210" height="36" rx="18" ry="18" fill="#F8F4F3" stroke="#805448" stroke-width="1.2" />
    <text x="105" y="23" text-anchor="middle" class="pill-text" fill="#5D372E">Cross-Spectrum Consensus</text>
  </g>

  <!-- Domain Stamp -->
  <text x="1090" y="529" text-anchor="end" class="domain">neus.news</text>
</svg>`;
}

export default async function handler(req: any, res?: any) {
  let slug = '';
  if (req.query && typeof req.query.slug === 'string') {
    slug = req.query.slug;
  } else if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      slug = parsedUrl.searchParams.get('slug') || '';
    } catch {
      // Fallback
    }
  }

  slug = slug.trim().replace(/^\/+|\/+$/g, '');

  let headline = DEFAULT_HEADLINE;
  let summary = DEFAULT_SUMMARY;
  let statusText = 'DEVELOPING';
  let pill1 = '360° Story Angles';
  let pill2 = 'Multi-Source Coverage';

  if (slug) {
    try {
      const apiUrl =
        process.env.VITE_API_URL ||
        process.env.API_URL ||
        'https://neusapi-production.up.railway.app/graphql';

      const query = JSON.stringify({
        query: `query GetClusterOgData($slug: String!) {
          cluster(slug: $slug) {
            headline
            summary
            storyAngle
            articleCount
            story {
              title
              overview
              status
              clusters {
                id
                storyAngle
              }
            }
            articles {
              id
            }
          }
        }`,
        variables: { slug },
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Neus-OG-Image/1.0',
        },
        body: query,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (apiRes.ok) {
        const json: any = await apiRes.json();
        const cluster = json?.data?.cluster;

        if (cluster) {
          const story = cluster.story;
          const isMultiAngle = Boolean(story && story.clusters && story.clusters.length > 1);

          headline = (isMultiAngle && story?.title ? story.title : cluster.headline) || DEFAULT_HEADLINE;
          summary = (isMultiAngle && story?.overview ? story.overview : cluster.summary) || DEFAULT_SUMMARY;

          if (story?.status) {
            statusText = story.status.toUpperCase();
          } else {
            statusText = 'DEVELOPING';
          }

          if (isMultiAngle && story?.clusters?.length) {
            pill1 = `${story.clusters.length} Story Angles`;
          } else if (cluster.storyAngle) {
            pill1 = cluster.storyAngle;
          } else {
            pill1 = 'Neutral Synthesis';
          }

          const count = cluster.articleCount || (cluster.articles ? cluster.articles.length : 0);
          if (count > 0) {
            pill2 = `${count} Verified Sources`;
          } else {
            pill2 = 'Multi-Source Coverage';
          }
        }
      }
    } catch (err) {
      console.error('Error fetching data for OG image:', err);
    }
  }

  const svgString = buildSvg({ headline, summary, statusText, pill1, pill2 });
  const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();

  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
    );
    return res.status(200).send(pngBuffer);
  }

  return new Response(pngBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control':
        'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
}
