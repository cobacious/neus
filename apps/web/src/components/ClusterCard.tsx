import { Link } from 'react-router-dom';

interface Source {
  id: string;
  name: string;
  faviconUrl?: string | null;
}

interface Article {
  id: string;
  url: string;
  sourceRel: Source;
}

interface Cluster {
  id: string;
  headline: string;
  slug: string | null;
  summary: string;
  createdAt: string;
  lastUpdatedAt?: string | null;
  origin: string;
  articles: Article[];
}

export default function ClusterCard({ cluster }: { cluster: Cluster }) {
  // Helper function to format relative dates
  const formatRelativeDate = (timestamp: number | string | null | undefined): string => {
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
    return date.toLocaleDateString();
  };

  const firstSeen = formatRelativeDate(cluster.createdAt);
  const lastUpdated = cluster.lastUpdatedAt
    ? formatRelativeDate(cluster.lastUpdatedAt)
    : firstSeen;

  const sourcesMap = new Map(cluster.articles.map((a) => [a.sourceRel.id, a.sourceRel]));
  const sources = Array.from(sourcesMap.values());
  const visible = sources.slice(0, 5);
  const extra = sources.length - visible.length;

  return (
    <Link
      to={`/${cluster.slug || cluster.id}`}
      className="block bg-white border border-gray-200 shadow-sm hover:shadow-md p-5 rounded-lg hover:border-gray-300 transition-all duration-200"
    >
      <h2 className="text-xl font-bold text-gray-900 mb-2">{cluster.headline}</h2>
      <p className="text-gray-700 mb-3 line-clamp-3">{cluster.summary}</p>
      <div className="text-sm text-gray-500 mb-3">
        <span className="font-medium">First seen:</span> {firstSeen}
        {' • '}
        <span className="font-medium">Last updated:</span> {lastUpdated}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-600 font-medium">Sources:</span>
        {visible.map((source) => (
          <img
            key={source.id}
            src={source.faviconUrl || ''}
            alt={source.name}
            title={source.name}
            className="w-6 h-6 rounded-sm"
          />
        ))}
        {extra > 0 && <span className="text-xs text-gray-500">+{extra}</span>}
      </div>
    </Link>
  );
}
