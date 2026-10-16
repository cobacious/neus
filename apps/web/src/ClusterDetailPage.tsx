import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from 'urql';
import Loading from './components/Loading';
import StatusBadge, { resolveStoryStatus, STATUS_CONFIG } from './components/StatusBadge';
import { AngleItem } from './components/StoryAnglePills';
import StoryAngleFilterTabs, { resolveActiveAngleId } from './components/StoryAngleFilterTabs';
import ArticleTimelineSparkline, { TimelineArticle } from './components/ArticleTimelineSparkline';
import StoryAngleHistogram, { HistogramArticle } from './components/StoryAngleHistogram';
import { createAngleColorMap, DEFAULT_ANGLE_COLOR } from './utils/angleColors';
import {
  parseDate,
  formatRelativeTime,
  formatDateHeader,
  sortArticlesNewestFirst,
} from './utils/dateUtils';
import { isPaywalled } from './utils/paywallUtils';
import SourceFavicon from './components/SourceFavicon';

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
              paywalled
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
          paywalled
        }
      }
    }
  }
`;

export default function ClusterDetailPage() {
  const { slug } = useParams();
  const [result] = useQuery({ query: CLUSTER_QUERY, variables: { slug } });

  const cluster = result.data?.cluster;
  const story = cluster?.story;
  const isMultiAngleStory = Boolean(story && story.clusters && story.clusters.length > 1);
  const headline = isMultiAngleStory && story ? story.title : cluster?.headline;
  const summary = isMultiAngleStory && story?.overview ? story.overview : cluster?.summary;

  const [expandedAngleIds, setExpandedAngleIds] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const angleParam = searchParams.get('angle');

  const validClusterIds =
    isMultiAngleStory && story?.clusters ? story.clusters.map((c: any) => c.id) : [];
  const selectedAngleId = isMultiAngleStory
    ? resolveActiveAngleId(validClusterIds, angleParam)
    : null;

  const toggleAngleExpansion = (angleId: string) => {
    setExpandedAngleIds((prev) => {
      const next = new Set(prev);
      if (next.has(angleId)) {
        next.delete(angleId);
      } else {
        next.add(angleId);
      }
      return next;
    });
  };

  const handleSelectAngle = (angleId: string | null, shouldScroll = false) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!angleId || angleId === selectedAngleId) {
      nextParams.delete('angle');
    } else {
      nextParams.set('angle', angleId);
    }
    setSearchParams(nextParams, { replace: false });

    if (shouldScroll) {
      const el = document.getElementById('articles-coverage');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    if (!headline) return;

    document.title = `${headline} - Neus`;

    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el) {
        el.setAttribute('content', content);
      }
    };

    const ensureMeta = (selector: string, attr: string, attrVal: string, content: string) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', summary || '');
    setMeta('meta[property="og:title"]', headline);
    setMeta('meta[property="og:description"]', summary || '');
    setMeta('meta[property="og:url"]', window.location.href);
    setMeta('meta[name="twitter:title"]', headline);
    setMeta('meta[name="twitter:description"]', summary || '');
    setMeta('meta[name="twitter:card"]', 'summary_large_image');

    const staticOgImage = 'https://neus.news/og-image.png';
    ensureMeta('meta[property="og:image"]', 'property', 'og:image', staticOgImage);
    ensureMeta('meta[name="twitter:image"]', 'name', 'twitter:image', staticOgImage);

    return () => {
      document.title = 'Neus - Neutral News';
      setMeta(
        'meta[name="description"]',
        'Bringing balance and neutrality to the news feed without clickbait or bias.'
      );
      setMeta('meta[property="og:title"]', 'Neus - Neutral News');
      setMeta(
        'meta[property="og:description"]',
        'Bringing balance and neutrality to the news feed without clickbait or bias.'
      );
      setMeta('meta[property="og:url"]', 'https://neus.news');
      setMeta('meta[name="twitter:title"]', 'Neus - Neutral News');
      setMeta(
        'meta[name="twitter:description"]',
        'Bringing balance and neutrality to the news feed without clickbait or bias.'
      );
      setMeta('meta[name="twitter:card"]', 'summary_large_image');
      ensureMeta('meta[property="og:image"]', 'property', 'og:image', staticOgImage);
      ensureMeta('meta[name="twitter:image"]', 'name', 'twitter:image', staticOgImage);
    };
  }, [headline, summary, slug]);

  if (result.fetching) return <Loading />;
  if (result.error || !cluster) {
    return (
      <div className="bg-white shadow-xs p-8 rounded-lg text-center">
        <p className="text-gray-600 mb-4">Error loading cluster or story</p>
        <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
          ← Back to list
        </Link>
      </div>
    );
  }

  let earliestCreatedAt = cluster.createdAt;
  if (isMultiAngleStory && story?.clusters) {
    story.clusters.forEach((c: any) => {
      if (c.createdAt) {
        const cTime = parseDate(c.createdAt)?.getTime();
        const curTime = parseDate(earliestCreatedAt)?.getTime();
        if (cTime && (!curTime || cTime < curTime)) {
          earliestCreatedAt = c.createdAt;
        }
      }
    });
  }

  const status = resolveStoryStatus(story?.status, {
    createdAt: earliestCreatedAt,
    lastUpdatedAt: cluster.lastUpdatedAt,
    isMultiAngle: isMultiAngleStory,
  });

  // 1. Gather all angles
  const angles: AngleItem[] =
    isMultiAngleStory && story?.clusters
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

  // Fallback for standalone: group articles by publication date (newest first)
  const sortedStandaloneArticles = sortArticlesNewestFirst(cluster.articles || []);

  const standaloneArticlesByDate: { [date: string]: any[] } = {};
  sortedStandaloneArticles.forEach((article: any) => {
    const date = formatDateHeader(article.publishedAt);
    if (!standaloneArticlesByDate[date]) {
      standaloneArticlesByDate[date] = [];
    }
    standaloneArticlesByDate[date].push(article);
  });

  const statusConfig = status ? STATUS_CONFIG[status] : null;

  return (
    <div
      className="relative bg-white shadow-xs border border-gray-200 p-6 rounded-lg"
      style={
        statusConfig ? { borderTopColor: statusConfig.topBorder, borderTopWidth: 2 } : undefined
      }
    >
      {/* Straddling Top-Border Status Badge */}
      {status && (
        <div className="absolute right-6 top-0 -translate-y-1/2 z-10">
          <StatusBadge status={status} size="md" />
        </div>
      )}

      {/* Top action bar */}
      <div className="flex items-center justify-between mb-4">
        <Link
          to="/"
          className="inline-flex items-center text-gray-500 hover:text-gray-900 font-medium transition-colors text-sm"
        >
          ← Back to list
        </Link>
        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
          <button
            type="button"
            onClick={() => {
              navigator
                .share({
                  title: headline || 'Neus Story',
                  url: window.location.href,
                })
                .catch(() => {});
            }}
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors cursor-pointer"
            aria-label="Share story"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share
          </button>
        )}
      </div>

      {/* Archive notification */}
      {cluster.archived && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-3 rounded-r">
          <p className="text-sm text-yellow-700">
            This story cluster has been archived and is no longer active.
          </p>
        </div>
      )}

      {/* Main Headline */}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 my-2 leading-tight">
        {isMultiAngleStory && story ? story.title : cluster.headline}
      </h1>

      {/* Main Summary */}
      <p className="text-gray-700 my-4 text-base leading-relaxed">
        {isMultiAngleStory && story?.overview ? story.overview : cluster.summary}
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
        <StoryAngleHistogram articles={allArticles} angles={angles} colorMap={colorMap} />
      </div>

      {/* Articles grouped by Angle (Feature 3) */}
      <div id="articles-coverage" className="mt-8 pt-4 border-t border-gray-200 scroll-mt-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-gray-900">
            {isMultiAngleStory ? 'Articles by Angle' : 'Articles Coverage'}
          </h3>
          {selectedAngleId && (
            <button
              type="button"
              onClick={() => handleSelectAngle(null, false)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            >
              Show all angles ✕
            </button>
          )}
        </div>

        {isMultiAngleStory && (
          <StoryAngleFilterTabs
            angles={angles}
            colorMap={colorMap}
            selectedAngleId={selectedAngleId}
            totalArticlesCount={allArticles.length}
            onSelectAngle={(angleId) => handleSelectAngle(angleId, false)}
          />
        )}

        {isMultiAngleStory && story?.clusters ? (
          <div className="space-y-8">
            {(selectedAngleId
              ? story.clusters.filter((c: any) => c.id === selectedAngleId)
              : story.clusters
            ).map((c: any) => {
              const angleName = c.storyAngle || c.headline || 'Angle';
              const angleStyle =
                colorMap.get(c.id) || colorMap.get(angleName) || DEFAULT_ANGLE_COLOR;
              const angleArticles = sortArticlesNewestFirst(c.articles || []);
              const isExpanded = expandedAngleIds.has(c.id);
              const hasMoreArticles = angleArticles.length > 10;
              const visibleArticles =
                hasMoreArticles && !isExpanded ? angleArticles.slice(0, 10) : angleArticles;

              return (
                <div
                  key={c.id}
                  className="border border-gray-200 border-l-4 rounded-r-lg rounded-l-xs p-5 bg-gray-50/50"
                  style={{ borderLeftColor: angleStyle.border }}
                >
                  {/* Angle Header */}
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: angleStyle.border }}
                        aria-hidden="true"
                      />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                        {angleName}
                      </h4>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      {angleArticles.length} {angleArticles.length === 1 ? 'article' : 'articles'}
                    </span>
                  </div>

                  {/* Angle Headline & Summary */}
                  {c.headline && (
                    <h5 className="text-base font-bold text-gray-900 mt-2 mb-1">{c.headline}</h5>
                  )}
                  {c.summary && (
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">{c.summary}</p>
                  )}

                  {/* Angle Articles List */}
                  <ul className="space-y-2.5 mt-3">
                    {visibleArticles.map((article: any) => (
                      <li key={article.id}>
                        <a
                          href={article.url}
                          className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-all group"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <SourceFavicon
                            source={article.sourceRel || { name: article.source }}
                            className="w-5 h-5 mt-0.5 rounded-xs"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-900 group-hover:text-blue-600 transition-colors font-medium text-sm">
                              {article.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                              <span>{article.sourceRel?.name || article.source}</span>
                              {isPaywalled(article.sourceRel || article.source) && (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-full"
                                  title="Subscription required"
                                >
                                  <span>🔒</span>
                                  <span>Subscription</span>
                                </span>
                              )}
                              {article.publishedAt && (
                                <>
                                  <span>•</span>
                                  <span>{formatRelativeTime(article.publishedAt)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>

                  {/* Progressive Disclosure Toggle */}
                  {hasMoreArticles && (
                    <div className="mt-3 pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAngleExpansion(c.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <span>Show fewer</span>
                            <span aria-hidden="true">↑</span>
                          </>
                        ) : (
                          <>
                            <span>Show {angleArticles.length - 10} more articles</span>
                            <span aria-hidden="true">↓</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
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
                        <SourceFavicon
                          source={article.sourceRel || { name: article.source }}
                          className="w-5 h-5 mt-0.5 rounded-xs"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-900 group-hover:text-blue-600 transition-colors font-medium text-sm">
                            {article.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <span>{article.sourceRel?.name || article.source}</span>
                            {isPaywalled(article.sourceRel || article.source) && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-full"
                                title="Subscription required"
                              >
                                <span>🔒</span>
                                <span>Subscription</span>
                              </span>
                            )}
                            {article.publishedAt && (
                              <>
                                <span>•</span>
                                <span>{formatRelativeTime(article.publishedAt)}</span>
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
