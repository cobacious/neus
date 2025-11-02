import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'urql';
import Loading from './components/Loading';

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
        title
        source
        url
      }
    }
  }
`;

export default function ClusterDetailPage() {
  const { id } = useParams();
  const [result] = useQuery({ query: CLUSTER_QUERY, variables: { id } });

  if (result.fetching) return <Loading />;
  if (result.error || !result.data.cluster) return <p>Error loading cluster</p>;

  const cluster = result.data.cluster;
  const date = new Date(cluster.createdAt).toLocaleDateString();

  return (
    <div className="bg-white shadow p-4 rounded">
      <Link to="/" className="text-blue-600 underline">
        Back to list
      </Link>
      <h2 className="text-xl font-semibold my-3">{cluster.headline}</h2>
      <div className="text-sm text-gray-500">{date}</div>
      <p className="text-gray-600 my-3">{cluster.summary}</p>
      <ul className="list-inside space-y-3">
        {cluster.articles.map((article: any) => (
          <li key={article.id}>
            <a
              href={article.url}
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {`${article.title} | ${article.source}`}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
