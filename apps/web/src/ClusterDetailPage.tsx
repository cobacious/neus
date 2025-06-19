import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'urql';

const CLUSTER_QUERY = `
  query Cluster($id: String!) {
    cluster(id: $id) {
      id
      headline
      summary
      createdAt
      origin
      articles {
        id
        url
      }
    }
  }
`;

export default function ClusterDetailPage() {
  const { id } = useParams();
  const [result] = useQuery({ query: CLUSTER_QUERY, variables: { id } });

  if (result.fetching) return <p>Loading cluster...</p>;
  if (result.error || !result.data.cluster) return <p>Error loading cluster</p>;

  const cluster = result.data.cluster;
  const date = new Date(cluster.createdAt).toLocaleDateString();

  return (
    <div className="space-y-2">
      <Link to="/" className="text-blue-600 underline">
        Back to list
      </Link>
      <h2 className="text-xl font-semibold">{cluster.headline}</h2>
      <p className="text-gray-600">{cluster.summary}</p>
      <div className="text-sm text-gray-500">
        {cluster.origin} • {date}
      </div>
      <ul className="list-disc list-inside space-y-1">
        {cluster.articles.map((article: any) => (
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
