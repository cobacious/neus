interface Article {
  id: string;
  url: string;
}

interface Cluster {
  id: string;
  headline: string;
  summary: string;
  createdAt: string;
  origin: string;
  articles: Article[];
}

export default function ClusterCard({ cluster }: { cluster: Cluster }) {
  const date = new Date(cluster.createdAt).toLocaleDateString();

  return (
    <div className="bg-white shadow p-4 rounded">
      <h2 className="text-xl font-semibold">{cluster.headline}</h2>
      <p className="text-gray-600 mb-2">{cluster.summary}</p>
      <div className="text-sm text-gray-500 mb-2">
        {cluster.origin} • {date}
      </div>
      <ul className="list-disc list-inside space-y-1">
        {cluster.articles.map((article) => (
          <li key={article.id}>
            <a
              href={article.url}
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {article.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
