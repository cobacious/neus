import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'urql';
import Loading from './components/Loading';
import StatusBadge, { resolveStoryStatus } from './components/StatusBadge';
import StoryAnglePills, { AngleItem } from './components/StoryAnglePills';
import ArticleTimelineSparkline, { TimelineArticle } from './components/ArticleTimelineSparkline';
import StoryAngleHistogram, { HistogramArticle } from './components/StoryAngleHistogram';
import { createAngleColorMap, DEFAULT_ANGLE_COLOR } from './utils/angleColors';

const CLUSTER_QUERY = `
  query Cluster($slug: String!) {
    cluster(slug: $slug) {
      id
      headline
      slug
      summary
      createdAt
      lastUpdatedAt
      origin
      archived
      storyId
      storyAngle
      story {
        id
        title
        slug
        overview
        status
        clusters {
          id
          headline
          slug
          summary
          storyAngle
          createdAt
          articles {
            id
            title
            source
            url
            publishedAt
            sourceRel {
              id
              name
              faviconUrl
            }
          }
        }
      }
      articles {
        id
        title
        source
        url
        publishedAt
        sourceRel {
          id
          name
          faviconUrl
        }
      }
    }
  }
`;

function formatRelativeDate(timestamp: number | string | null | undefined): string {
  if (!timestamp) return 'N/A';
  const date = new Date(Number(timestamp));
  if (isNaN(date.getTime())) return 'Invalid Date';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ClusterDetailPage() {
  const { slug } = useParams();
  const [result] = useQuery({ query: CLUSTER_QUERY, variables: { slug } });

  if (result.fetching) return <Loading />;
  if (result.error || !result.data?.cluster) {
    return (
      <div className="bg-white shadow-xs p-8 rounded-lg text-center">
        <p className="text-gray-600 mb-4">Error loading cluster or story</p>
        <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
          ← Back to list
        </Link>
      </div>
    );
  }

  const cluster = result.data.cluster;
  const story = cluster.story;
  const isMultiAngleStory = Boolean(story && story.clusters && story.clusters.length > 1);
  const status = resolveStoryStatus(story?.status, cluster);

  // 1. Gather all angles
  const angles: AngleItem[] = isMultiAngleStory && story?.clusters
    ? story.clusters.map((c: any) => ({
        id: c.id,
        name: c.storyAngle || c.headline || 'Angle',
        articleCount: c.articles ? c.articles.length : 0,
      }))
    : [];

  const colorMap = createAngleColorMap(angles);

  // 2. Gather all articles across the story
  const allArticles: (TimelineArticle & HistogramArticle & { fullArticle: any })[] = [];
  const articlesByAngleId = new Map<string, any[]>();

  if (isMultiAngleStory && story?.clusters) {
    story.clusters.forEach((c: any) => {
      const angleId = c.id;
      const angleName = c.storyAngle || c.headline || undefined;
      const angleArticles = c.articles || [];
      articlesByAngleId.set(angleId, angleArticles);

      angleArticles.forEach((a: any) => {
        allArticles.push({
          id: a.id,
          title: a.title,
          publishedAt: a.publishedAt,
          source: a.source,
          url: a.url,
          sourceRel: a.sourceRel,
          angleId,
          angleName,
          fullArticle: a,
        });
      });
    });
  } else {
    cluster.articles.forEach((a: any) => {
      allArticles.push({
        id: a.id,
        title: a.title,
        publishedAt: a.publishedAt,
        source: a.source,
        url: a.url,
        sourceRel: a.sourceRel,
        angleId: cluster.id,
        angleName: cluster.storyAngle || undefined,
        fullArticle: a,
      });
    });
  }

  // Fallback for standalone: group articles by publication date
  const sortedStandaloneArticles = [...cluster.articles].sort((a: any, b: any) => {
    const dateA = new Date(a.publishedAt).getTime();
    const dateB = new Date(b.publishedAt).getTime();
    if (isNaN(dateA) && isNaN(dateB)) return 0;
    if (isNaN(dateA)) return 1;
    if (isNaN(dateB)) return -1;
    return dateB - dateA;
  });

  const standaloneArticlesByDate: { [date: string]: any[] } = {};
  sortedStandaloneArticles.forEach((article: any) => {
    const articleDate = new Date(article.publishedAt);
    const date = isNaN(articleDate.getTime())
      ? 'Unknown Date'
      : articleDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (!standaloneArticlesByDate[date]) {
      standaloneArticlesByDate[date] = [];
    }
    standaloneArticlesByDate[date].push(article);
  });

  return (
    <div className="bg-white shadow-xs border border-gray-200 p-6 rounded-lg">
      {/* Back button */}
      <Link
        to="/"
        className="inline-flex items-center text-gray-500 hover:text-gray-900 font-medium mb-4 transition-colors text-sm"
      >
        ← Back to list
      </Link>

      {/* Archive notification */}
      {cluster.archived && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-3 rounded-r">
          <p className="text-sm text-yellow-700">
            This story cluster has been archived and is no longer active.
          </p>
        </div>
      )}

      {/* Story Context Eyebrow & Status Badge (Feature 1) */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        {story ? (
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Story: <span className="text-gray-800 normal-case font-medium">{story.title}</span>
          </div>
        ) : (
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Report
          </div>
        )}
        <StatusBadge status={status} size="md" />
      </div>

      {/* Main Headline */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 my-2 leading-tight">
        {cluster.headline}
      </h1>

      {/* Angle pills (Feature 2) */}
      {angles.length > 1 && (
        <div className="my-3">
          <div className="text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
            Story Angles:
          </div>
          <StoryAnglePills angles={angles} colorMap={colorMap} size="md" />
        </div>
      )}

      {/* Main Summary */}
      <p className="text-gray-700 my-4 text-base leading-relaxed">
        {cluster.summary}
      </p>

      {/* Timeline Sparkline (Feature 5) */}
      <div className="my-5 pt-3 border-t border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Chronological Coverage
        </div>
        <ArticleTimelineSparkline
          articles={allArticles}
          colorMap={colorMap}
          fallbackFirstSeen={cluster.createdAt}
          fallbackLastUpdated={cluster.lastUpdatedAt}
        />
      </div>

      {/* Histogram on cluster details view (Feature 4) */}
      <div className="my-6">
        <StoryAngleHistogram
          articles={allArticles}
          angles={angles}
          colorMap={colorMap}
        />
      </div>

      {/* Articles grouped by Angle (Feature 3) */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-5">
          {isMultiAngleStory ? 'Articles by Angle' : 'Articles Coverage'}
        </h3>

        {isMultiAngleStory && story?.clusters ? (
          <div className="space-y-8">
            {story.clusters.map((c: any) => {
              const angleName = c.storyAngle || c.headline || 'Angle';
              const angleStyle =
                colorMap.get(c.id) ||
                colorMap.get(angleName) ||
                DEFAULT_ANGLE_COLOR;
              const angleArticles = c.articles || [];

              return (
                <div key={c.id} className="border border-gray-200 rounded-lg p-5 bg-gray-50/50">
                  {/* Angle Header */}
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border"
                        style={{
                          backgroundColor: angleStyle.bg,
                          borderColor: angleStyle.border,
                          color: angleStyle.text,
                        }}
                      >
                        {angleName}
                      </span>
                      {c.id === cluster.id && (
                        <span className="text-[11px] text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200 font-medium">
                          Viewing Angle
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      {angleArticles.length} {angleArticles.length === 1 ? 'article' : 'articles'}
                    </span>
                  </div>

                  {/* Angle Headline & Summary */}
                  {c.headline && c.headline !== cluster.headline && (
                    <h4 className="text-base font-bold text-gray-900 mt-2 mb-1">
                      {c.headline}
                    </h4>
                  )}
                  {c.summary && c.summary !== cluster.summary && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {c.summary}
                    </p>
                  )}

                  {/* Angle Articles List */}
                  <ul className="space-y-2.5 mt-3">
                    {angleArticles.map((article: any) => (
                      <li key={article.id}>
                        <a
                          href={article.url}
                          className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-all group"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {article.sourceRel?.faviconUrl && (
                            <img
                              src={article.sourceRel.faviconUrl}
                              alt=""
                              className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-xs"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-900 group-hover:text-blue-600 transition-colors font-medium text-sm">
                              {article.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                              <span>{article.sourceRel?.name || article.source}</span>
                              {article.publishedAt && (
                                <>
                                  <span>•</span>
                                  <span>{formatRelativeDate(article.publishedAt)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          /* Standalone Cluster: Group by Date */
          <div className="space-y-6">
            {Object.keys(standaloneArticlesByDate).map((date) => (
              <div key={date}>
                <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">
                  {date}
                </h4>
                <ul className="space-y-2.5">
                  {standaloneArticlesByDate[date].map((article: any) => (
                    <li key={article.id}>
                      <a
                        href={article.url}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {article.sourceRel?.faviconUrl && (
                          <img
                            src={article.sourceRel.faviconUrl}
                            alt=""
                            className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-xs"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-900 group-hover:text-blue-600 transition-colors font-medium text-sm">
                            {article.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <span>{article.sourceRel?.name || article.source}</span>
                            {article.publishedAt && (
                              <>
                                <span>•</span>
                                <span>{formatRelativeDate(article.publishedAt)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
