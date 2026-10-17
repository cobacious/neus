function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapCdata(content: string): string {
  return `<![CDATA[${content.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

export interface AngleItem {
  id: string;
  headline?: string | null;
  slug?: string | null;
  summary?: string | null;
  storyAngle?: string | null;
  articleCount?: number | null;
  lastUpdatedAt?: number | null;
  createdAt?: number | null;
}

export interface StoryData {
  id: string;
  title: string;
  overview?: string | null;
  clusters?: AngleItem[] | null;
}

export interface ClusterFeedItem {
  id: string;
  headline?: string | null;
  slug?: string | null;
  summary?: string | null;
  createdAt?: number | null;
  lastUpdatedAt?: number | null;
  articleCount?: number | null;
  storyId?: string | null;
  story?: StoryData | null;
}

const SITE_URL = 'https://neus.news';
const FEED_TITLE = 'Neus - Neutral News';
const FEED_DESCRIPTION =
  'Bringing balance and neutrality to the news feed without clickbait or bias.';

export function generateRssXml(clusters: ClusterFeedItem[], buildDate = new Date()): string {
  const seenStoryIds = new Set<string>();
  const itemsXml: string[] = [];

  for (const cluster of clusters) {
    if (!cluster.slug) continue;

    const story = cluster.story;
    const storyId = story?.id || cluster.storyId;
    if (storyId && seenStoryIds.has(storyId)) {
      continue;
    }

    const isMultiAngleStory =
      Boolean(storyId && story?.clusters && story.clusters.length > 1);

    if (isMultiAngleStory && story) {
      seenStoryIds.add(story.id);

      const angles = (story.clusters || []).filter((c) => Boolean(c.slug));
      const primarySlug = cluster.slug || angles[0]?.slug;
      if (!primarySlug) continue;

      const title = escapeXml(story.title || cluster.headline || 'Developing Story');
      const itemUrl = `${SITE_URL}/${primarySlug}`;

      // Calculate latest timestamp across all angles
      const timestamps = [
        cluster.lastUpdatedAt,
        cluster.createdAt,
        ...angles.map((a) => a.lastUpdatedAt || a.createdAt),
      ].filter((ts): ts is number => typeof ts === 'number' && !isNaN(ts) && ts > 0);

      const latestTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
      const pubDate = new Date(latestTime).toUTCString();

      const angleLines = angles
        .map((a) => {
          const label = escapeXml(a.storyAngle || a.headline || 'General Thread');
          const count = a.articleCount ? ` (${a.articleCount} articles)` : '';
          const summary = a.summary ? `: ${escapeXml(a.summary)}` : '';
          return `<li><strong>${label}</strong>${count}${summary}</li>`;
        })
        .join('');

      const overviewHtml = story.overview
        ? `<p>${escapeXml(story.overview)}</p>`
        : cluster.summary
          ? `<p>${escapeXml(cluster.summary)}</p>`
          : '';

      const contentHtml = [
        overviewHtml,
        angles.length > 0 ? `<p><strong>Tracked Perspectives and Threads:</strong></p><ul>${angleLines}</ul>` : '',
        `<p><a href="${itemUrl}">Read full coverage and explore balanced perspectives on Neus</a></p>`,
      ]
        .filter(Boolean)
        .join('');

      itemsXml.push(`    <item>
      <title>${title}</title>
      <link>${itemUrl}</link>
      <guid isPermaLink="true">${itemUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${wrapCdata(contentHtml)}</description>
    </item>`);
    } else {
      const title = escapeXml(cluster.headline || 'Developing Story');
      const itemUrl = `${SITE_URL}/${cluster.slug}`;
      const itemTime = cluster.lastUpdatedAt || cluster.createdAt || Date.now();
      const pubDate = new Date(itemTime).toUTCString();

      const summaryHtml = cluster.summary ? `<p>${escapeXml(cluster.summary)}</p>` : '';
      const countNote = cluster.articleCount
        ? `<p><small>Synthesised from ${cluster.articleCount} independent articles.</small></p>`
        : '';

      const contentHtml = [
        summaryHtml,
        countNote,
        `<p><a href="${itemUrl}">Read full coverage on Neus</a></p>`,
      ]
        .filter(Boolean)
        .join('');

      itemsXml.push(`    <item>
      <title>${title}</title>
      <link>${itemUrl}</link>
      <guid isPermaLink="true">${itemUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${wrapCdata(contentHtml)}</description>
    </item>`);
    }
  }

  const lastBuildDate = buildDate.toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml.join('\n')}
  </channel>
</rss>`;
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
        query: `query GetRssClusters {
          clusters(limit: 50) {
            id
            headline
            slug
            summary
            createdAt
            lastUpdatedAt
            articleCount
            storyId
            story {
              id
              title
              overview
              clusters {
                id
                headline
                slug
                summary
                storyAngle
                articleCount
                lastUpdatedAt
                createdAt
              }
            }
          }
        }`,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL query failed with HTTP status ${response.status}`);
    }

    const payload = (await response.json()) as any;
    const clusters: ClusterFeedItem[] = payload?.data?.clusters || [];
    const xml = generateRssXml(clusters);

    // Support Node.js runtime
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      res.setHeader(
        'Cache-Control',
        'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600'
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
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    const fallbackXml = generateRssXml([]);

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      if (typeof res.status === 'function') {
        return res.status(200).send(fallbackXml);
      }
      res.statusCode = 200;
      return res.end(fallbackXml);
    }

    return new Response(fallbackXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
      },
    });
  }
}
