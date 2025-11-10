import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'urql';
import Loading from './components/Loading';

const CLUSTER_QUERY = `
  query Cluster($slug: String!) {
    cluster(slug: $slug) {
      id
      headline
      summary
      createdAt
      origin
      archived
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
  const { slug } = useParams();
  const [result] = useQuery({ query: CLUSTER_QUERY, variables: { slug } });

  if (result.fetching) return <Loading />;
  if (result.error || !result.data.cluster)
    return <p className="text-center">Error loading cluster</p>;

  const cluster = result.data.cluster;
  const date = new Date(cluster.createdAt).toLocaleDateString();

  return (
    <div className="bg-white shadow p-4 rounded">
      <Link to="/" className="text-blue-600 underline">
        Back to list
      </Link>

      {cluster.archived && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                This story cluster has been archived and is no longer active.
              </p>
            </div>
          </div>
        </div>
      )}

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
