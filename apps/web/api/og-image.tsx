import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

const DEFAULT_HEADLINE = 'Restoring balance and neutrality to the news feed.';
const DEFAULT_SUMMARY =
  'Algorithmic multi-angle clustering, neutral AI synthesis and cross-source consensus without clickbait or rage-bait.';

export default async function handler(req: Request) {
  let headline = DEFAULT_HEADLINE;
  let summary = DEFAULT_SUMMARY;
  let statusText = 'NEUTRAL NEWS';
  let pill1 = '360° Story Angles';
  let pill2 = 'Source Diversity';

  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug')?.trim();

    if (slug) {
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
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Neus-OG-Image/1.0',
        },
        body: query,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json: any = await res.json();
        const cluster = json?.data?.cluster;

        if (cluster) {
          const story = cluster.story;
          const isMultiAngle = Boolean(story && story.clusters && story.clusters.length > 1);

          headline = (isMultiAngle && story?.title ? story.title : cluster.headline) || DEFAULT_HEADLINE;
          summary = (isMultiAngle && story?.overview ? story.overview : cluster.summary) || DEFAULT_SUMMARY;

          if (story?.status) {
            statusText = story.status.toUpperCase();
          } else {
            statusText = 'DEVELOPING STORY';
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
    }
  } catch (err) {
    console.error('Error fetching data for OG image:', err);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F9FAFB',
        }}
      >
        <div
          style={{
            width: 1120,
            height: 550,
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px 70px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top 6 Block-Colour Stripe */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 8,
              display: 'flex',
            }}
          >
            <div style={{ flex: 1, height: 8, backgroundColor: '#4F6D7A' }} />
            <div style={{ flex: 1, height: 8, backgroundColor: '#DD6E42' }} />
            <div style={{ flex: 1, height: 8, backgroundColor: '#B8C7B7' }} />
            <div style={{ flex: 1, height: 8, backgroundColor: '#D2BFDE' }} />
            <div style={{ flex: 1, height: 8, backgroundColor: '#805448' }} />
            <div style={{ flex: 1, height: 8, backgroundColor: '#575353' }} />
          </div>

          {/* Header: Logo + Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontSize: 54,
                fontWeight: 800,
                color: '#111827',
                letterSpacing: '-0.04em',
              }}
            >
              neus
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#EEF3F5',
                border: '1px solid #4F6D7A',
                color: '#223842',
                padding: '6px 16px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: '#DD6E42',
                  marginRight: 8,
                }}
              />
              {statusText}
            </div>
          </div>

          {/* Content: Headline + Neutral Summary */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 42,
                lineHeight: 1.18,
                fontWeight: 700,
                color: '#111827',
                letterSpacing: '-0.02em',
                maxHeight: 110,
                overflow: 'hidden',
              }}
            >
              {headline}
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 21,
                lineHeight: 1.45,
                color: '#4B5563',
                maxHeight: 65,
                overflow: 'hidden',
              }}
            >
              {summary}
            </div>
          </div>

          {/* Footer: Credibility Pills + Domain */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 24,
              borderTop: '1px solid #F3F4F6',
            }}
          >
            <div style={{ display: 'flex' }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '6px 16px',
                  borderRadius: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #4F6D7A',
                  color: '#38505B',
                  backgroundColor: '#F3F7F8',
                  marginRight: 12,
                }}
              >
                {pill1}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '6px 16px',
                  borderRadius: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #DD6E42',
                  color: '#9C4524',
                  backgroundColor: '#FCF5F2',
                  marginRight: 12,
                }}
              >
                {pill2}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '6px 16px',
                  borderRadius: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #805448',
                  color: '#5D372E',
                  backgroundColor: '#F8F4F3',
                }}
              >
                Cross-Spectrum Consensus
              </div>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#4F6D7A',
                letterSpacing: '-0.01em',
              }}
            >
              neus.news
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control':
          'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    }
  );
}
