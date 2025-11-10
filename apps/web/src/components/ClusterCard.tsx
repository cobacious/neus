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
  // Helper function to safely convert timestamps to dates
  const toLocalDate = (timestamp: number | string | null | undefined): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(Number(timestamp));
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
  };

  const firstSeen = toLocalDate(cluster.createdAt);
  const lastUpdated = cluster.lastUpdatedAt
    ? toLocalDate(cluster.lastUpdatedAt)
    : firstSeen;

  const sourcesMap = new Map(cluster.articles.map((a) => [a.sourceRel.id, a.sourceRel]));
  const sources = Array.from(sourcesMap.values());
  const visible = sources.slice(0, 5);
  const extra = sources.length - visible.length;

  return (
    <Link
      to={`/${cluster.slug || cluster.id}`}
      className="block bg-white shadow p-4 rounded hover:bg-gray-50"
    >
      <h2 className="text-xl font-semibold">{cluster.headline}</h2>
      <p className="text-gray-600 mb-2">{cluster.summary}</p>
      <div className="text-sm text-gray-500 mb-2">
        <span className="font-medium">First seen:</span> {firstSeen}
        {' • '}
        <span className="font-medium">Last updated:</span> {lastUpdated}
      </div>
      <div className="flex items-center space-x-1">
        {visible.map((source) => (
          <img
            key={source.id}
            src={source.faviconUrl || ''}
            alt={source.name}
            title={source.name}
            className="w-5 h-5"
          />
        ))}
        {extra > 0 && <span className="text-xs text-gray-500">+{extra}</span>}
      </div>
    </Link>
  );
}
