import { Link } from 'react-router-dom';
import StatusBadge, { resolveStoryStatus, STATUS_CONFIG } from './StatusBadge';
import StoryAnglePills, { AngleItem } from './StoryAnglePills';
import ArticleTimelineSparkline, { TimelineArticle } from './ArticleTimelineSparkline';
import { createAngleColorMap } from '../utils/angleColors';
import { parseDate } from '../utils/dateUtils';
import { isPaywalled } from '../utils/paywallUtils';

interface Source {
  id: string;
  name: string;
  faviconUrl?: string | null;
}

interface Article {
  id: string;
  url?: string;
  title?: string;
  source?: string;
  publishedAt?: string;
  sourceRel?: Source | null;
}

interface SiblingCluster {
  id: string;
  headline?: string | null;
  slug?: string | null;
  storyAngle?: string | null;
  createdAt?: string | number | null;
  articles?: Article[];
}

interface Story {
  id: string;
  title: string;
  slug?: string | null;
  overview?: string | null;
  status?: string | null;
  clusters?: SiblingCluster[];
}

export interface Cluster {
  id: string;
  headline: string;
  slug: string | null;
  summary: string;
  createdAt: string | number;
  lastUpdatedAt?: string | number | null;
  origin: string;
  storyId?: string | null;
  storyAngle?: string | null;
  story?: Story | null;
  articles: Article[];
}

export default function ClusterCard({ cluster }: { cluster: Cluster }) {
  const story = cluster.story;
  // If part of a multi-angle story, aggregate all sibling clusters
  const isMultiAngleStory = Boolean(story && story.clusters && story.clusters.length > 1);

  // Compute story-level inception to ensure multi-day stories decay from breaking to developing
  let earliestCreatedAt = cluster.createdAt;
  if (isMultiAngleStory && story?.clusters) {
    story.clusters.forEach((c) => {
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

  // Extract angles
  const angles: AngleItem[] = isMultiAngleStory && story?.clusters
    ? story.clusters.map((c) => ({
        id: c.id,
        name: c.storyAngle || c.headline || 'Angle',
        articleCount: c.articles ? c.articles.length : undefined,
      }))
    : [];

  const colorMap = createAngleColorMap(angles);

  // Aggregate articles for the timeline sparkline
  let timelineArticles: TimelineArticle[] = [];
  let sourcesMap = new Map<string, Source>();

  if (isMultiAngleStory && story?.clusters) {
    story.clusters.forEach((c) => {
      const angleId = c.id;
      const angleName = c.storyAngle || c.headline || undefined;
      (c.articles || []).forEach((a) => {
        timelineArticles.push({
          id: a.id,
          title: a.title,
          publishedAt: a.publishedAt,
          source: a.source,
          sourceRel: a.sourceRel,
          angleId,
          angleName,
        });
        if (a.sourceRel?.id) {
          sourcesMap.set(a.sourceRel.id, a.sourceRel);
        }
      });
    });
  } else {
    timelineArticles = cluster.articles.map((a) => {
      if (a.sourceRel?.id) {
        sourcesMap.set(a.sourceRel.id, a.sourceRel);
      }
      return {
        id: a.id,
        title: a.title,
        publishedAt: a.publishedAt,
        source: a.source,
        sourceRel: a.sourceRel,
        angleId: cluster.id,
        angleName: cluster.storyAngle || undefined,
      };
    });
  }

  const sources = Array.from(sourcesMap.values());
  const visibleSources = sources.slice(0, 5);
  const extraSources = sources.length - visibleSources.length;

  const statusConfig = status ? STATUS_CONFIG[status] : null;

  return (
    <Link
      to={`/${cluster.slug || cluster.id}`}
      className="relative block bg-white border border-gray-200 shadow-xs hover:shadow-md p-5 rounded-lg hover:border-gray-300 transition-all duration-200"
      style={statusConfig ? { borderTopColor: statusConfig.topBorder, borderTopWidth: 2 } : undefined}
    >
      {/* Straddling Top-Border Status Badge */}
      {status && (
        <div className="absolute right-4 top-0 -translate-y-1/2 z-10">
          <StatusBadge status={status} size="sm" />
        </div>
      )}

      {/* Main Headline */}
      <h2 className="text-xl font-bold text-gray-900 mb-2 leading-snug">
        {isMultiAngleStory && story ? story.title : cluster.headline}
      </h2>

      {/* Summary */}
      <p className="text-gray-700 mb-3 line-clamp-3 text-sm leading-relaxed">
        {isMultiAngleStory && story?.overview ? story.overview : cluster.summary}
      </p>

      {/* Representation of angles on multi-angle stories */}
      {angles.length > 1 && (
        <div className="mb-3">
          <StoryAnglePills angles={angles} colorMap={colorMap} size="sm" />
        </div>
      )}

      {/* Timeline Sparkline replacing old text */}
      <div className="mb-3 pt-1 border-t border-gray-100">
        <ArticleTimelineSparkline
          articles={timelineArticles}
          colorMap={colorMap}
          fallbackFirstSeen={cluster.createdAt}
          fallbackLastUpdated={cluster.lastUpdatedAt}
        />
      </div>

      {/* Footer: Article count & Sources */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <span className="text-xs text-gray-600 font-medium">
          {timelineArticles.length} {timelineArticles.length === 1 ? 'article' : 'articles'}
          {angles.length > 1 && ` across ${angles.length} angles`}
        </span>
        <span className="text-xs text-gray-300">•</span>
        <span className="text-xs text-gray-600 font-medium">Sources:</span>
        {visibleSources.map((source) => {
          const paywalled = isPaywalled(source);
          return (
            <div key={source.id} className="relative inline-flex items-center">
              <img
                src={source.faviconUrl || ''}
                alt={source.name}
                title={`${source.name}${paywalled ? ' (Subscription required)' : ''}`}
                className="w-5 h-5 rounded-xs"
              />
              {paywalled && (
                <span
                  className="absolute -top-1 -right-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold shadow-xs select-none"
                  title={`${source.name} (Subscription required)`}
                >
                  🔒
                </span>
              )}
            </div>
          );
        })}
        {extraSources > 0 && <span className="text-xs text-gray-500">+{extraSources}</span>}
      </div>
    </Link>
  );
}
